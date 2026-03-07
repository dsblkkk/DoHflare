/*
 * DoHflare - High-Performance DNS over HTTPS Edge Proxy for Cloudflare Workers & Pages
 * Copyright (C) 2026  Racpast <https://github.com/racpast/DoHflare>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * ADDITIONAL NOTICE: Pursuant to Section 7 of the GNU AGPLv3,
 * additional terms apply to this work. Refer to the NOTICE file
 * in the repository for details regarding attribution requirements,
 * trademark disclaimers, and compliance policies.
 */

/* ==========================================================================
   1. ISOLATE LEVEL CONSTANTS & RUNTIME DEFAULTS
   ========================================================================== */
const ISOLATE_CONSTANTS = {
  MEMORY_CACHE_LIMIT: 2000,
  MEMORY_CACHE_SIZE_BYTES: 8 * 1024 * 1024,
};

const RUNTIME_DEFAULTS = {
  UPSTREAM_URLS: [
    "https://dns.google/dns-query",
    "https://dns11.quad9.net/dns-query",
  ],
  DOH_CONTENT_TYPE: "application/dns-message",
  DOH_PATH: "/dns-query",

  ROOT_CONTENT: null,
  ROOT_CONTENT_TYPE: "text/html; charset=utf-8",
  ROOT_CACHE_TTL: 86400,

  MAX_CACHEABLE_BYTES: 64 * 1024,
  MAX_POST_BODY_BYTES: 8 * 1024,
  FETCH_TIMEOUT_MS: 2500,
  MAX_RETRIES: 2,

  DEFAULT_POSITIVE_TTL: 60,
  DEFAULT_NEGATIVE_TTL: 15,
  FALLBACK_ECS_IP: "119.29.29.0",

  CF_CACHE_WRITE_THRESHOLD: 500,
  GLOBAL_WRITE_COOLDOWN_MS: 5 * 60 * 1000,
  GLOBAL_WRITE_PER_MINUTE_LIMIT: 200,

  HOT_WINDOW_MS: 60 * 1000,
  HOT_HIT_THRESHOLD: 20,

  STALE_WINDOW_FACTOR: 0.5,
  EXTREME_STALE_FALLBACK_MS: 24 * 3600 * 1000,
  JITTER_PCT: 10,

  GLOBAL_CACHE_NAMESPACE: "https://dohflare.local/cache/",
};

/* ==========================================================================
   2. DNS PROTOCOL CONSTANTS & ERROR CODES
   ========================================================================== */
const DNS_CONSTANTS = {
  HEADER_LEN: 12,
  OFFSET_ID: 0,
  OFFSET_QDCOUNT: 4,
  OFFSET_ANCOUNT: 6,
  OFFSET_NSCOUNT: 8,
  OFFSET_ARCOUNT: 10,
  TYPE_OPT: 41,
  OPT_CODE_ECS: 8,
  RCODE_NXDOMAIN: 3,
  MAX_NAME_ITERATIONS: 130,
  OPT_HEADER_TEMPLATE: new Uint8Array([
    0x00, 0x00, 0x29, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]),
};

const ERRORS = {
  OOB: "OOB_READ",
  LOOP: "MALFORMED_LOOP",
  TIMEOUT: "UPSTREAM_TIMEOUT",
  OVERSIZED: "PAYLOAD_TOO_LARGE",
};

/* ==========================================================================
   3. UTILITIES & HASH FUNCTIONS
   ========================================================================== */
function generateFnv1a32Hex(dataView) {
  let hashValue = 0x811c9dc5;
  for (let index = 0; index < dataView.length; index++) {
    hashValue ^= dataView[index];
    hashValue = Math.imul(hashValue, 0x01000193);
  }
  return (hashValue >>> 0).toString(16).padStart(8, "0");
}

function convertBase64UrlToBuffer(base64UrlString) {
  let base64String = base64UrlString.replace(/-/g, "+").replace(/_/g, "/");
  while (base64String.length % 4) base64String += "=";
  const decodedString = atob(base64String);
  const byteArray = new Uint8Array(decodedString.length);
  for (let index = 0; index < decodedString.length; index++)
    byteArray[index] = decodedString.charCodeAt(index);
  return byteArray.buffer;
}

function normalizeClientIp(rawIpAddress, fallbackIpAddress) {
  if (!rawIpAddress) return fallbackIpAddress;
  rawIpAddress = rawIpAddress.trim();
  const colonIndex = rawIpAddress.indexOf(":");
  if (colonIndex !== -1 && rawIpAddress.split(":").length > 2)
    return rawIpAddress;
  if (colonIndex !== -1) return rawIpAddress.split(":")[0];
  return rawIpAddress;
}

async function executeFetchWithTimeout(
  requestUrl,
  fetchOptions,
  timeoutMilliseconds,
) {
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
    return fetch(requestUrl, {
      ...fetchOptions,
      signal: AbortSignal.timeout(timeoutMilliseconds),
    });
  }
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    timeoutMilliseconds,
  );
  try {
    const fetchResponse = await fetch(requestUrl, {
      ...fetchOptions,
      signal: abortController.signal,
    });
    return fetchResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ==========================================================================
   4. LRU CACHE & GLOBAL STATE
   ========================================================================== */
class LRUCacheNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class MemoryLRUCache {
  constructor(maxItemCount, maxSizeBytes) {
    this.maxItemCount = maxItemCount;
    this.maxSizeBytes = maxSizeBytes;
    this.nodeMap = new Map();
    this.headNode = null;
    this.tailNode = null;
    this.currentSizeBytes = 0;
  }

  peek(cacheKey) {
    const targetNode = this.nodeMap.get(cacheKey);
    return targetNode ? targetNode.value : null;
  }

  get(cacheKey, extremeStaleMilliseconds) {
    const targetNode = this.nodeMap.get(cacheKey);
    if (!targetNode) return null;
    if (
      Date.now() >
      targetNode.value.expiryTimestamp + extremeStaleMilliseconds
    ) {
      this.delete(cacheKey);
      return null;
    }
    this._moveNodeToHead(targetNode);
    return targetNode.value;
  }

  set(cacheKey, cacheValue, extremeStaleMilliseconds) {
    const existingNode = this.nodeMap.get(cacheKey);
    if (existingNode) {
      const oldCacheValue = existingNode.value;
      cacheValue.hitTimestamps = oldCacheValue.hitTimestamps;
      cacheValue.currentHitIndex = oldCacheValue.currentHitIndex;
      cacheValue.totalHitCount = oldCacheValue.totalHitCount;
      cacheValue.lastGlobalWriteTimestamp =
        oldCacheValue.lastGlobalWriteTimestamp ||
        cacheValue.lastGlobalWriteTimestamp;
      this.delete(cacheKey);
    }
    cacheValue.hardExpiryTimestamp =
      cacheValue.expiryTimestamp + extremeStaleMilliseconds;
    const newNode = new LRUCacheNode(cacheKey, cacheValue);
    this._addNodeToHead(newNode);
    this.nodeMap.set(cacheKey, newNode);
    this.currentSizeBytes += cacheValue.payloadSize || 0;
    this._evictStaleNodes();
  }

  delete(cacheKey) {
    const targetNode = this.nodeMap.get(cacheKey);
    if (!targetNode) return;
    this._removeNode(targetNode);
    this.nodeMap.delete(cacheKey);
    this.currentSizeBytes = Math.max(
      0,
      this.currentSizeBytes - (targetNode.value.payloadSize || 0),
    );
  }

  _evictStaleNodes() {
    while (
      (this.nodeMap.size > this.maxItemCount ||
        this.currentSizeBytes > this.maxSizeBytes) &&
      this.tailNode
    ) {
      this.delete(this.tailNode.key);
    }
  }

  _addNodeToHead(targetNode) {
    targetNode.next = this.headNode;
    targetNode.prev = null;
    if (this.headNode) this.headNode.prev = targetNode;
    this.headNode = targetNode;
    if (!this.tailNode) this.tailNode = targetNode;
  }

  _removeNode(targetNode) {
    if (targetNode.prev) targetNode.prev.next = targetNode.next;
    if (targetNode.next) targetNode.next.prev = targetNode.prev;
    if (this.headNode === targetNode) this.headNode = targetNode.next;
    if (this.tailNode === targetNode) this.tailNode = targetNode.prev;
    targetNode.prev = targetNode.next = null;
  }

  _moveNodeToHead(targetNode) {
    this._removeNode(targetNode);
    this._addNodeToHead(targetNode);
  }
}

const primaryMemoryCache = new MemoryLRUCache(
  ISOLATE_CONSTANTS.MEMORY_CACHE_LIMIT,
  ISOLATE_CONSTANTS.MEMORY_CACHE_SIZE_BYTES,
);
const requestCoalescingMap = new Map();
const activeGlobalWriteLocks = new Set();
let rateLimitWindowStartTimestamp = 0;
let rateLimitWriteCount = 0;

/* ==========================================================================
   5. DNS PACKET PARSER & MANIPULATOR
   ========================================================================== */
class DnsPacketProcessor {
  static skipDnsNameSafely(dataView, startOffset) {
    let currentOffset = startOffset;
    let iterationCount = 0;
    while (currentOffset < dataView.byteLength) {
      if (iterationCount++ > DNS_CONSTANTS.MAX_NAME_ITERATIONS)
        throw new Error(ERRORS.LOOP);
      const labelLength = dataView.getUint8(currentOffset);
      if (labelLength === 0) return currentOffset + 1;
      if ((labelLength & 0xc0) === 0xc0) {
        if (currentOffset + 2 > dataView.byteLength)
          throw new Error(ERRORS.OOB);
        return currentOffset + 2;
      }
      currentOffset += labelLength + 1;
      if (currentOffset > dataView.byteLength) throw new Error(ERRORS.OOB);
    }
    throw new Error(ERRORS.OOB);
  }

  static verifyEcsOptionPresence(packetBuffer) {
    try {
      const dataView = new DataView(packetBuffer);
      if (packetBuffer.byteLength < DNS_CONSTANTS.HEADER_LEN) return false;
      let currentOffset = DNS_CONSTANTS.HEADER_LEN;
      const questionCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_QDCOUNT);
      const answerCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_ANCOUNT);
      const authorityCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_NSCOUNT);
      const additionalCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_ARCOUNT);
      for (let index = 0; index < questionCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        currentOffset += 4;
      }
      for (let index = 0; index < answerCount + authorityCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        if (currentOffset + 10 > dataView.byteLength) return false;
        currentOffset += 8 + 2 + dataView.getUint16(currentOffset + 8);
      }
      for (let index = 0; index < additionalCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        if (currentOffset + 10 > dataView.byteLength) return false;
        const recordType = dataView.getUint16(currentOffset);
        const recordDataLength = dataView.getUint16(currentOffset + 8);
        currentOffset += 10;
        if (recordType === DNS_CONSTANTS.TYPE_OPT) {
          let optionOffset = currentOffset;
          const optionEndOffset = currentOffset + recordDataLength;
          if (optionEndOffset > dataView.byteLength) return false;
          while (optionOffset + 4 <= optionEndOffset) {
            if (dataView.getUint16(optionOffset) === DNS_CONSTANTS.OPT_CODE_ECS)
              return true;
            optionOffset += 4 + dataView.getUint16(optionOffset + 2);
          }
        }
        currentOffset += recordDataLength;
      }
      return false;
    } catch {
      return false;
    }
  }

  static constructEcsOptionPayload(clientIpAddress, fallbackIpAddress) {
    const targetIp = clientIpAddress || fallbackIpAddress;
    const isIPv4Format = targetIp.indexOf(":") === -1;
    if (isIPv4Format) {
      const ipOctets = targetIp
        .split(".")
        .map((octet) => Math.max(0, Math.min(255, Number(octet) || 0)));
      const payloadBytes = [ipOctets[0], ipOctets[1], ipOctets[2]];
      const totalOptionLength = 4 + payloadBytes.length;
      const optionBuffer = new Uint8Array(4 + totalOptionLength);
      optionBuffer.set(
        [
          0x00,
          DNS_CONSTANTS.OPT_CODE_ECS,
          (totalOptionLength >> 8) & 0xff,
          totalOptionLength & 0xff,
          0x00,
          0x01,
          24,
          0x00,
        ],
        0,
      );
      optionBuffer.set(payloadBytes, 8);
      return optionBuffer;
    } else {
      const ipSegments = targetIp.split("::");
      const leftSegments = ipSegments[0]
        ? ipSegments[0].split(":").filter(Boolean)
        : [];
      const rightSegments =
        ipSegments.length > 1 && ipSegments[1]
          ? ipSegments[1].split(":").filter(Boolean)
          : [];
      const leftNumericSegments = leftSegments.map(
        (hexStr) => parseInt(hexStr, 16) || 0,
      );
      const rightNumericSegments = rightSegments.map(
        (hexStr) => parseInt(hexStr, 16) || 0,
      );
      const combinedSegments = [...leftNumericSegments];
      const missingSegmentsCount = Math.max(
        0,
        8 - (leftNumericSegments.length + rightNumericSegments.length),
      );
      for (let index = 0; index < missingSegmentsCount; index++)
        combinedSegments.push(0);
      combinedSegments.push(...rightNumericSegments);
      const ipByteArray = new Uint8Array(16);
      for (let index = 0; index < 8; index++) {
        ipByteArray[index * 2] = (combinedSegments[index] >> 8) & 0xff;
        ipByteArray[index * 2 + 1] = combinedSegments[index] & 0xff;
      }
      const prefixPayloadBytes = ipByteArray.slice(0, 7); // /56 prefix length
      const totalOptionLength = 4 + prefixPayloadBytes.length;
      const optionBuffer = new Uint8Array(4 + totalOptionLength);
      optionBuffer.set(
        [
          0x00,
          DNS_CONSTANTS.OPT_CODE_ECS,
          (totalOptionLength >> 8) & 0xff,
          totalOptionLength & 0xff,
          0x00,
          0x02,
          56,
          0x00,
        ],
        0,
      );
      optionBuffer.set(prefixPayloadBytes, 8);
      return optionBuffer;
    }
  }

  static injectEcsPayload(
    originalQueryBuffer,
    clientIpAddress,
    fallbackIpAddress,
  ) {
    try {
      if (this.verifyEcsOptionPresence(originalQueryBuffer))
        return originalQueryBuffer;
      const dataView = new DataView(originalQueryBuffer);
      if (originalQueryBuffer.byteLength < DNS_CONSTANTS.HEADER_LEN)
        return originalQueryBuffer;

      const questionCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_QDCOUNT);
      const answerCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_ANCOUNT);
      const authorityCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_NSCOUNT);
      const additionalCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_ARCOUNT);
      let currentOffset = DNS_CONSTANTS.HEADER_LEN;

      for (let index = 0; index < questionCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        currentOffset += 4;
      }
      for (let index = 0; index < answerCount + authorityCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        if (currentOffset + 10 > dataView.byteLength)
          throw new Error(ERRORS.OOB);
        currentOffset += 8 + 2 + dataView.getUint16(currentOffset + 8);
      }

      let targetRecordOffset = -1;
      let targetDataLengthOffset = -1;
      let targetDataLength = 0;

      for (let index = 0; index < additionalCount; index++) {
        const recordStartOffset = currentOffset;
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        if (currentOffset + 10 > dataView.byteLength)
          throw new Error(ERRORS.OOB);
        const recordType = dataView.getUint16(currentOffset);
        if (recordType === DNS_CONSTANTS.TYPE_OPT) {
          targetRecordOffset = recordStartOffset;
          targetDataLengthOffset = currentOffset + 8;
          targetDataLength = dataView.getUint16(targetDataLengthOffset);
          break;
        }
        currentOffset += 8 + 2 + dataView.getUint16(currentOffset + 8);
      }

      const ecsOptionBuffer = this.constructEcsOptionPayload(
        clientIpAddress,
        fallbackIpAddress,
      );

      if (targetRecordOffset !== -1) {
        const insertionPosition = targetDataLengthOffset + 2 + targetDataLength;
        if (insertionPosition > originalQueryBuffer.byteLength)
          throw new Error(ERRORS.OOB);
        const modifiedBufferLength =
          originalQueryBuffer.byteLength + ecsOptionBuffer.length;
        const modifiedBuffer = new Uint8Array(modifiedBufferLength);
        modifiedBuffer.set(
          new Uint8Array(originalQueryBuffer, 0, insertionPosition),
          0,
        );
        modifiedBuffer.set(ecsOptionBuffer, insertionPosition);
        modifiedBuffer.set(
          new Uint8Array(originalQueryBuffer, insertionPosition),
          insertionPosition + ecsOptionBuffer.length,
        );
        new DataView(modifiedBuffer.buffer).setUint16(
          targetDataLengthOffset,
          targetDataLength + ecsOptionBuffer.length,
        );
        return modifiedBuffer.buffer;
      } else {
        const insertionPosition = originalQueryBuffer.byteLength;
        const modifiedBufferLength =
          insertionPosition +
          DNS_CONSTANTS.OPT_HEADER_TEMPLATE.length +
          ecsOptionBuffer.length;
        const modifiedBuffer = new Uint8Array(modifiedBufferLength);
        modifiedBuffer.set(new Uint8Array(originalQueryBuffer), 0);
        modifiedBuffer.set(
          DNS_CONSTANTS.OPT_HEADER_TEMPLATE,
          insertionPosition,
        );
        const modifiedDataView = new DataView(modifiedBuffer.buffer);
        modifiedDataView.setUint16(
          insertionPosition + DNS_CONSTANTS.OPT_HEADER_TEMPLATE.length - 2,
          ecsOptionBuffer.length,
        );
        modifiedBuffer.set(
          ecsOptionBuffer,
          insertionPosition + DNS_CONSTANTS.OPT_HEADER_TEMPLATE.length,
        );
        modifiedDataView.setUint16(
          DNS_CONSTANTS.OFFSET_ARCOUNT,
          (additionalCount + 1) & 0xffff,
        );
        return modifiedBuffer.buffer;
      }
    } catch {
      return originalQueryBuffer;
    }
  }

  static stripEcsPayload(responseBuffer) {
    try {
      const dataView = new DataView(responseBuffer);
      if (responseBuffer.byteLength < DNS_CONSTANTS.HEADER_LEN)
        return responseBuffer;
      const questionCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_QDCOUNT);
      const answerCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_ANCOUNT);
      const authorityCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_NSCOUNT);
      const additionalCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_ARCOUNT);
      let currentOffset = DNS_CONSTANTS.HEADER_LEN;
      for (let index = 0; index < questionCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        currentOffset += 4;
      }
      for (let index = 0; index < answerCount + authorityCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        if (currentOffset + 10 > dataView.byteLength)
          throw new Error(ERRORS.OOB);
        currentOffset += 8 + 2 + dataView.getUint16(currentOffset + 8);
      }

      for (let index = 0; index < additionalCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        if (currentOffset + 10 > dataView.byteLength) break;
        const recordType = dataView.getUint16(currentOffset);
        const dataLengthOffset = currentOffset + 8;
        const recordDataLength = dataView.getUint16(dataLengthOffset);
        if (recordType === DNS_CONSTANTS.TYPE_OPT) {
          let innerOptionOffset = dataLengthOffset + 2;
          const innerOptionEnd = innerOptionOffset + recordDataLength;
          if (innerOptionEnd > dataView.byteLength) throw new Error(ERRORS.OOB);
          let ecsDataOffset = -1;
          let ecsDataLength = 0;

          while (innerOptionOffset + 4 <= innerOptionEnd) {
            const optionCode = dataView.getUint16(innerOptionOffset);
            const optionLength = dataView.getUint16(innerOptionOffset + 2);
            if (optionCode === DNS_CONSTANTS.OPT_CODE_ECS) {
              ecsDataOffset = innerOptionOffset;
              ecsDataLength = 4 + optionLength;
              break;
            }
            innerOptionOffset += 4 + optionLength;
          }

          if (ecsDataOffset !== -1) {
            const strippedBufferLength =
              responseBuffer.byteLength - ecsDataLength;
            const strippedBuffer = new Uint8Array(strippedBufferLength);
            strippedBuffer.set(
              new Uint8Array(responseBuffer, 0, ecsDataOffset),
              0,
            );
            strippedBuffer.set(
              new Uint8Array(responseBuffer, ecsDataOffset + ecsDataLength),
              ecsDataOffset,
            );
            new DataView(strippedBuffer.buffer).setUint16(
              dataLengthOffset,
              recordDataLength - ecsDataLength,
            );
            return strippedBuffer.buffer;
          }
        }
        currentOffset += 10 + recordDataLength;
      }
      return responseBuffer;
    } catch {
      return responseBuffer;
    }
  }

  static extractTtlAndResponseCode(responseBuffer, defaultPositiveTtlValue) {
    let responseCode = 0;
    try {
      const dataView = new DataView(responseBuffer);
      if (responseBuffer.byteLength < DNS_CONSTANTS.HEADER_LEN)
        return { extractedTtl: defaultPositiveTtlValue, responseCode };
      responseCode = dataView.getUint8(3) & 0x0f;
      let currentOffset = DNS_CONSTANTS.HEADER_LEN;
      const questionCount = dataView.getUint16(DNS_CONSTANTS.OFFSET_QDCOUNT);
      const totalResourceRecords =
        dataView.getUint16(DNS_CONSTANTS.OFFSET_ANCOUNT) +
        dataView.getUint16(DNS_CONSTANTS.OFFSET_NSCOUNT) +
        dataView.getUint16(DNS_CONSTANTS.OFFSET_ARCOUNT);
      for (let index = 0; index < questionCount; index++) {
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        if (currentOffset + 4 > dataView.byteLength)
          return { extractedTtl: defaultPositiveTtlValue, responseCode };
        currentOffset += 4;
      }
      let minimumTtlValue = Infinity;
      for (let index = 0; index < totalResourceRecords; index++) {
        if (currentOffset >= dataView.byteLength) break;
        currentOffset = this.skipDnsNameSafely(dataView, currentOffset);
        if (currentOffset + 10 > dataView.byteLength) break;
        const recordType = dataView.getUint16(currentOffset);
        currentOffset += 4;
        const recordTtl = dataView.getUint32(currentOffset);
        currentOffset += 4;
        const recordDataLength = dataView.getUint16(currentOffset);
        currentOffset += 2;
        if (currentOffset + recordDataLength > dataView.byteLength) break;
        if (recordType !== DNS_CONSTANTS.TYPE_OPT)
          minimumTtlValue = Math.min(minimumTtlValue, recordTtl);
        currentOffset += recordDataLength;
      }
      return {
        extractedTtl:
          isFinite(minimumTtlValue) && minimumTtlValue > 0
            ? minimumTtlValue
            : defaultPositiveTtlValue,
        responseCode,
      };
    } catch {
      return { extractedTtl: defaultPositiveTtlValue, responseCode };
    }
  }

  static generateStableCacheKey(processedQueryBuffer) {
    try {
      if (processedQueryBuffer.byteLength < DNS_CONSTANTS.HEADER_LEN)
        throw new Error("Invalid Buffer");
      const normalizedDataView = new Uint8Array(processedQueryBuffer.slice(0));
      normalizedDataView[0] = 0;
      normalizedDataView[1] = 0;
      return generateFnv1a32Hex(normalizedDataView);
    } catch {
      return generateFnv1a32Hex(new Uint8Array(processedQueryBuffer).slice(2));
    }
  }

  static patchTransactionId(payloadByteArray, transactionIdByteArray) {
    const patchedBuffer = new Uint8Array(payloadByteArray.byteLength);
    patchedBuffer.set(payloadByteArray);
    patchedBuffer[0] = transactionIdByteArray[0];
    patchedBuffer[1] = transactionIdByteArray[1];
    return patchedBuffer.buffer;
  }
}

/* ==========================================================================
   6. REQUEST HANDLER
   ========================================================================== */
class DoHRequestHandler {
  static initializeConfig(environmentVariables) {
    const parseArraySafely = (jsonString, fallbackArray) => {
      if (!jsonString) return fallbackArray;
      try {
        return JSON.parse(jsonString);
      } catch {
        return fallbackArray;
      }
    };

    return {
      UPSTREAM_URLS: parseArraySafely(
        environmentVariables.UPSTREAM_URLS,
        RUNTIME_DEFAULTS.UPSTREAM_URLS,
      ),
      DOH_CONTENT_TYPE:
        environmentVariables.DOH_CONTENT_TYPE ||
        RUNTIME_DEFAULTS.DOH_CONTENT_TYPE,
      DOH_PATH: environmentVariables.DOH_PATH || RUNTIME_DEFAULTS.DOH_PATH,
      ROOT_CONTENT:
        environmentVariables.ROOT_CONTENT || RUNTIME_DEFAULTS.ROOT_CONTENT,
      ROOT_CONTENT_TYPE:
        environmentVariables.ROOT_CONTENT_TYPE ||
        RUNTIME_DEFAULTS.ROOT_CONTENT_TYPE,
      ROOT_CACHE_TTL: environmentVariables.ROOT_CACHE_TTL
        ? parseInt(environmentVariables.ROOT_CACHE_TTL, 10)
        : RUNTIME_DEFAULTS.ROOT_CACHE_TTL,
      MAX_CACHEABLE_BYTES: environmentVariables.MAX_CACHEABLE_BYTES
        ? parseInt(environmentVariables.MAX_CACHEABLE_BYTES, 10)
        : RUNTIME_DEFAULTS.MAX_CACHEABLE_BYTES,
      MAX_POST_BODY_BYTES: environmentVariables.MAX_POST_BODY_BYTES
        ? parseInt(environmentVariables.MAX_POST_BODY_BYTES, 10)
        : RUNTIME_DEFAULTS.MAX_POST_BODY_BYTES,
      FETCH_TIMEOUT_MS: environmentVariables.FETCH_TIMEOUT_MS
        ? parseInt(environmentVariables.FETCH_TIMEOUT_MS, 10)
        : RUNTIME_DEFAULTS.FETCH_TIMEOUT_MS,
      MAX_RETRIES: environmentVariables.MAX_RETRIES
        ? parseInt(environmentVariables.MAX_RETRIES, 10)
        : RUNTIME_DEFAULTS.MAX_RETRIES,
      DEFAULT_POSITIVE_TTL: environmentVariables.DEFAULT_POSITIVE_TTL
        ? parseInt(environmentVariables.DEFAULT_POSITIVE_TTL, 10)
        : RUNTIME_DEFAULTS.DEFAULT_POSITIVE_TTL,
      DEFAULT_NEGATIVE_TTL: environmentVariables.DEFAULT_NEGATIVE_TTL
        ? parseInt(environmentVariables.DEFAULT_NEGATIVE_TTL, 10)
        : RUNTIME_DEFAULTS.DEFAULT_NEGATIVE_TTL,
      FALLBACK_ECS_IP:
        environmentVariables.FALLBACK_ECS_IP ||
        RUNTIME_DEFAULTS.FALLBACK_ECS_IP,
      CF_CACHE_WRITE_THRESHOLD: environmentVariables.CF_CACHE_WRITE_THRESHOLD
        ? parseInt(environmentVariables.CF_CACHE_WRITE_THRESHOLD, 10)
        : RUNTIME_DEFAULTS.CF_CACHE_WRITE_THRESHOLD,
      GLOBAL_WRITE_COOLDOWN_MS: environmentVariables.GLOBAL_WRITE_COOLDOWN_MS
        ? parseInt(environmentVariables.GLOBAL_WRITE_COOLDOWN_MS, 10)
        : RUNTIME_DEFAULTS.GLOBAL_WRITE_COOLDOWN_MS,
      GLOBAL_WRITE_PER_MINUTE_LIMIT:
        environmentVariables.GLOBAL_WRITE_PER_MINUTE_LIMIT
          ? parseInt(environmentVariables.GLOBAL_WRITE_PER_MINUTE_LIMIT, 10)
          : RUNTIME_DEFAULTS.GLOBAL_WRITE_PER_MINUTE_LIMIT,
      HOT_WINDOW_MS: environmentVariables.HOT_WINDOW_MS
        ? parseInt(environmentVariables.HOT_WINDOW_MS, 10)
        : RUNTIME_DEFAULTS.HOT_WINDOW_MS,
      HOT_HIT_THRESHOLD: environmentVariables.HOT_HIT_THRESHOLD
        ? parseInt(environmentVariables.HOT_HIT_THRESHOLD, 10)
        : RUNTIME_DEFAULTS.HOT_HIT_THRESHOLD,
      STALE_WINDOW_FACTOR: environmentVariables.STALE_WINDOW_FACTOR
        ? parseFloat(environmentVariables.STALE_WINDOW_FACTOR)
        : RUNTIME_DEFAULTS.STALE_WINDOW_FACTOR,
      EXTREME_STALE_FALLBACK_MS: environmentVariables.EXTREME_STALE_FALLBACK_MS
        ? parseInt(environmentVariables.EXTREME_STALE_FALLBACK_MS, 10)
        : RUNTIME_DEFAULTS.EXTREME_STALE_FALLBACK_MS,
      JITTER_PCT: environmentVariables.JITTER_PCT
        ? parseInt(environmentVariables.JITTER_PCT, 10)
        : RUNTIME_DEFAULTS.JITTER_PCT,
      GLOBAL_CACHE_NAMESPACE:
        environmentVariables.GLOBAL_CACHE_NAMESPACE ||
        RUNTIME_DEFAULTS.GLOBAL_CACHE_NAMESPACE,
    };
  }

  static checkWriteRateLimit(requestConfig) {
    const currentTimestamp = Date.now();
    if (currentTimestamp - rateLimitWindowStartTimestamp > 60 * 1000) {
      rateLimitWindowStartTimestamp = currentTimestamp;
      rateLimitWriteCount = 0;
    }
    if (rateLimitWriteCount < requestConfig.GLOBAL_WRITE_PER_MINUTE_LIMIT) {
      rateLimitWriteCount++;
      return true;
    }
    return false;
  }

  static calculateDeterministicJitter(cacheKeyHex, jitterPercentage) {
    const hashSuffixValue = parseInt(cacheKeyHex.slice(-4), 16) % 10000;
    const signedJitter =
      (hashSuffixValue / 10000) * (2 * jitterPercentage) - jitterPercentage;
    return 1 + signedJitter / 100.0;
  }

  static createResponse(
    payloadByteArray,
    transactionId,
    hasClientEcs,
    cacheAgeSeconds,
    cacheStatusIndicator,
    cacheKeyHex,
    requestConfig,
    httpStatus = 200,
    supplementalHeaders = {},
  ) {
    let finalResponseBuffer = DnsPacketProcessor.patchTransactionId(
      payloadByteArray,
      transactionId,
    );
    if (!hasClientEcs)
      finalResponseBuffer =
        DnsPacketProcessor.stripEcsPayload(finalResponseBuffer);
    const responseHeaders = {
      "Content-Type": requestConfig.DOH_CONTENT_TYPE,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${cacheAgeSeconds}`,
      "X-DOHFLARE-Cache": cacheStatusIndicator,
      "X-DOHFLARE-CacheKey": cacheKeyHex,
      "X-DOHFLARE-TTL": String(cacheAgeSeconds),
      "Content-Length": String(finalResponseBuffer.byteLength),
      ...supplementalHeaders,
    };
    return new Response(finalResponseBuffer, {
      status: httpStatus,
      headers: responseHeaders,
    });
  }

  static generateLandingPage(request, reqConfig) {
    const currentYear = new Date().getFullYear();
    const serviceHostname = new URL(request.url).hostname;
    const fullServiceEndpoint = `https://${serviceHostname}${reqConfig.DOH_PATH}`;

    return `<!doctypehtml><html lang="en"><meta charset="UTF-8"><meta content="width=device-width,initial-scale=1"name="viewport"><link href="data:image/x-icon;base64,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"rel="icon"type="image/x-icon"><title>DoHflare | Edge DNS Proxy</title><style>:root{--bg:#ffffff;--text:#1d1d1f;--accent:#0071e3;--cf-orange:#f38020;--sub:#86868b;--card:#f5f5f7;--border:#d2d2d7;--code-bg:#f5f5f7}@media (prefers-color-scheme:dark){:root{--bg:#0b0e14;--text:#e6edf3;--accent:#2f81f7;--sub:#7d8590;--card:#161b22;--border:#30363d;--code-bg:#0d1117}}body{font-family:-apple-system,BlinkMacSystemFont,Inter,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;line-height:1.6;overflow-x:hidden;transition:background .3s,color .3s}.container{width:100%;max-width:850px;padding:40px 24px;box-sizing:border-box;animation:fadeIn .8s ease-out}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.header{text-align:left;margin-bottom:48px;border-bottom:1px solid var(--border);padding-bottom:24px}h1{font-size:2.8rem;margin:0;font-weight:800;letter-spacing:-.03em;background:linear-gradient(135deg,var(--text) 30%,var(--accent) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.tagline{color:var(--sub);font-size:1.1rem;margin-top:8px;font-weight:500}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-bottom:48px}.card{background:var(--card);border:1px solid var(--border);padding:28px;border-radius:12px;transition:all .3s cubic-bezier(.4,0,.2,1);cursor:default}.card:hover{border-color:var(--accent);transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.15)}.card h3{margin:0 0 12px 0;font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);font-weight:700}.card p{margin:0;font-size:.95rem;color:var(--sub);font-weight:400;line-height:1.6}.endpoint-box{background:var(--code-bg);border:1px solid var(--border);padding:28px;border-radius:12px;text-align:left;margin-bottom:48px;transition:border-color .3s}.endpoint-box:hover{border-color:var(--sub)}.endpoint-label{display:block;font-size:.75rem;color:var(--sub);margin-bottom:12px;text-transform:uppercase;font-weight:700;letter-spacing:.05em}.code{font-family:SFMono-Regular,Consolas,"Liberation Mono",monospace;color:var(--accent);font-size:1.05rem;word-break:break-all}.links{display:flex;gap:32px;justify-content:flex-start}.links a{color:var(--text);text-decoration:none;font-size:.95rem;display:flex;align-items:center;font-weight:500;transition:color .2s}.links a:hover{color:var(--accent)}.links a svg{margin-right:8px;flex-shrink:0}.footer{margin-top:50px;text-align:left;font-size:.85rem;color:var(--sub);border-top:1px solid var(--border);padding-top:24px}.reveal-link{position:relative;text-decoration:none!important;transition:opacity .2s}.reveal-link::after{content:'';position:absolute;width:0;height:1.5px;bottom:-2px;left:50%;transform:translateX(-50%);transition:width .3s cubic-bezier(.4,0,.2,1)}.reveal-link:hover::after{width:100%}.author-link{color:inherit;font-weight:500}.author-link::after{background-color:var(--accent)}.author-link:hover{color:var(--accent);opacity:1}.cf-link{color:var(--cf-orange)!important;font-size:.8rem;font-weight:600;opacity:.9}.cf-link::after{background-color:var(--cf-orange)}.cf-link:hover{opacity:1}</style><div class="container"><header class="header"><h1>DoHflare</h1><div class="tagline">High-Performance DNS over HTTPS Edge Proxy for Cloudflare Workers &amp; Pages</div></header><div class="grid"><div class="card"><h3>Multi-Tiered Caching</h3><p>Combines L1 isolated in-memory caching with L2 distributed global storage. Strictly enforces TTL constraints to slash upstream resolution latency and maximize responsiveness.</div><div class="card"><h3>Precision Traffic Steering</h3><p>Full EDNS0 Client Subnet (ECS) support with privacy-preserving truncation. Directs CDNs to serve the optimal edge node IPs, dramatically improving resolution quality in complex network regions.</div><div class="card"><h3>Resilient Cache Logic</h3><p>Distributes cache keys via collision-resistant FNV-1a hashing. Paired with deterministic TTL jitter, it prevents cache stampedes and ensures rock-solid efficiency under high-concurrency loads.</div><div class="card"><h3>Intelligent Traffic Shaping</h3><p>Mitigates upstream overload and protocol abuse through request coalescing, payload validation, and global write-rate limiting, guaranteeing sustained service stability.</div></div><div class="endpoint-box"><span class="endpoint-label">Resolver Endpoint URL</span><div class="code">${fullServiceEndpoint}</div></div><div class="links"><a href="https://github.com/racpast/DoHflare"target="_blank"><svg fill="currentColor"height="19"viewBox="0 0 16 16"width="19"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg> GitHub </a><a href="https://dohflare.racpast.com/"target="_blank"><svg fill="currentColor"height="21"viewBox="0 0 1024 1024"width="21"><path d="M392.169 373.756 151.421 373.756c-7.911 0-14.279 6.389-14.279 14.28 0 7.851 6.368 14.24 14.279 14.24L392.17 402.276c7.851 0 14.24-6.388 14.24-14.24C406.409 380.146 400.021 373.756 392.169 373.756zM392.169 491.098 151.421 491.098c-7.911 0-14.279 6.408-14.279 14.278 0 7.892 6.368 14.261 14.279 14.261L392.17 519.637c7.851 0 14.24-6.368 14.24-14.261C406.409 497.505 400.021 491.098 392.169 491.098zM392.169 608.479 151.421 608.479c-7.911 0-14.279 6.406-14.279 14.276 0 7.873 6.368 14.261 14.279 14.261L392.17 637.016c7.851 0 14.24-6.388 14.24-14.261C406.409 614.885 400.021 608.479 392.169 608.479zM618.357 388.036c0 7.851 6.367 14.24 14.24 14.24l240.746 0c7.892 0 14.261-6.388 14.261-14.24 0-7.89-6.367-14.28-14.261-14.28L632.599 373.756C624.728 373.756 618.357 380.146 618.357 388.036zM873.347 491.098 632.599 491.098c-7.872 0-14.24 6.408-14.24 14.278 0 7.892 6.368 14.261 14.24 14.261l240.748 0c7.89 0 14.259-6.368 14.259-14.261C887.604 497.505 881.237 491.098 873.347 491.098zM873.347 608.479 632.599 608.479c-7.872 0-14.24 6.406-14.24 14.276 0 7.873 6.368 14.261 14.24 14.261l240.748 0c7.89 0 14.259-6.388 14.259-14.261C887.604 614.885 881.237 608.479 873.347 608.479zM751.301 132.346c-88.362 0-187.057 13.519-238.526 48.247-51.472-34.728-150.145-48.247-238.526-48.247-126.493 0-274.174 27.64-274.174 105.605l0 622.81c0 10.554 4.645 20.487 12.696 27.258 8.051 6.77 18.666 9.652 29.039 7.849 70.136-12.133 150.486-18.545 232.437-18.545 81.953 0 162.302 6.41 232.439 18.545 0.96 0.182 1.901 0.182 2.863 0.282 0.76 0.06 1.5 0.119 2.262 0.141 0.319 0.039 0.643 0.099 0.963 0.099 1.902 0 3.805-0.16 5.688-0.5 0.119-0.022 0.238 0 0.399-0.022 70.139-12.133 150.488-18.545 232.441-18.545 81.949 0 162.32 6.41 232.437 18.545 2.025 0.361 4.084 0.521 6.087 0.521 8.331 0 16.463-2.903 22.949-8.37 8.054-6.771 12.699-16.702 12.699-27.258L1025.474 237.951C1025.474 159.984 877.791 132.346 751.301 132.346zM71.371 819.203 71.371 242.457c14.418-14.121 85.636-38.813 202.876-38.813 117.221 0 188.458 24.693 202.876 38.813l0 576.747c-63.406-8.67-132.659-13.198-202.876-13.198C204.032 806.005 134.758 810.533 71.371 819.203zM954.177 819.203c-126.792-17.304-279.001-17.304-405.755 0L548.422 242.457c14.419-14.121 85.639-38.813 202.879-38.813 117.239 0 188.455 24.693 202.875 38.813L954.177 819.203 954.177 819.203z"/></svg> Documentation</a><a href="https://www.gnu.org/licenses/agpl-3.0.html"target="_blank"><svg fill="currentColor"height="21"viewBox="0 0 1024 1024"width="21"><path d="M640 938.666667H256c-93.866667 0-170.666667-76.8-170.666667-170.666667v-42.666667c0-25.6 17.066667-42.666667 42.666667-42.666666h42.666667V256c0-93.866667 76.8-170.666667 170.666666-170.666667h469.333334c72.533333 0 128 55.466667 128 128s-55.466667 128-128 128h-42.666667v469.333334c0 72.533333-55.466667 128-128 128zm-384-256h298.666667c25.6 0 42.666667 17.066667 42.666666 42.666666v85.333334c0 25.6 17.066667 42.666667 42.666667 42.666666s42.666667-17.066667 42.666667-42.666666V213.333333c0-17.066667 4.266667-29.866667 8.533333-42.666666H341.333333c-46.933333 0-85.333333 38.4-85.333333 85.333333v426.666667zm-85.333333 85.333333c0 46.933333 38.4 85.333333 85.333333 85.333333h264.533333c-4.266667-12.8-8.533333-25.6-8.533333-42.666666v-42.666667H170.666667zM768 256h42.666667c25.6 0 42.666667-17.066667 42.666666-42.666667s-17.066667-42.666667-42.666666-42.666666-42.666667 17.066667-42.666667 42.666666v42.666667zM554.666667 341.333333H384c-25.6 0-42.666667-17.066667-42.666667-42.666666s17.066667-42.666667 42.666667-42.666667h170.666667c25.6 0 42.666667 17.066667 42.666666 42.666667s-17.066667 42.666667-42.666666 42.666666zM554.666667 512H384c-25.6 0-42.666667-17.066667-42.666667-42.666667s17.066667-42.666667 42.666667-42.666666h170.666667c25.6 0 42.666667 17.066667 42.666666 42.666666s-17.066667 42.666667-42.666666 42.666667"/></svg> AGPL-3.0</a></div><footer class="footer">Copyright © ${currentYear} <a href="https://github.com/racpast"target="_blank"class="reveal-link author-link">Racpast</a>. All rights reserved.<br><span style="opacity:.8;margin-top:10px;display:block">Powered by <a href="https://workers.cloudflare.com/"target="_blank"class="reveal-link cf-link">Cloudflare Workers</a></span></footer></div>`;
  }

  static async processIncomingRequest(
    incomingRequest,
    environmentVariables,
    executionContext,
  ) {
    const requestConfig = this.initializeConfig(environmentVariables);
    const parsedUrl = new URL(incomingRequest.url);

    if (incomingRequest.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Accept",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    if (parsedUrl.pathname !== requestConfig.DOH_PATH) {
      if (parsedUrl.pathname === "/") {
        let responseContent;
        let responseType;

        if (
          requestConfig.ROOT_CONTENT &&
          requestConfig.ROOT_CONTENT.trim() !== ""
        ) {
          responseContent = requestConfig.ROOT_CONTENT;
          responseType = requestConfig.ROOT_CONTENT_TYPE;
        } else {
          responseContent = this.generateLandingPage(
            incomingRequest,
            requestConfig,
          );
          responseType = "text/html; charset=utf-8";
        }

        return new Response(responseContent, {
          status: 200,
          headers: {
            "Content-Type": responseType,
            "Cache-Control": `public, max-age=${requestConfig.ROOT_CACHE_TTL}`,
            "X-DOHFLARE-Mode": requestConfig.ROOT_CONTENT
              ? "Custom"
              : "Template",
          },
        });
      }
      return new Response("Not Found", { status: 404 });
    }

    let rawQueryBuffer;
    if (incomingRequest.method === "GET") {
      const dnsQueryParam = parsedUrl.searchParams.get("dns");
      if (!dnsQueryParam)
        return new Response("Bad Request: missing dns", { status: 400 });
      try {
        rawQueryBuffer = convertBase64UrlToBuffer(dnsQueryParam);
      } catch {
        return new Response("Bad Request: invalid base64url", { status: 400 });
      }
    } else if (incomingRequest.method === "POST") {
      if (
        !(incomingRequest.headers.get("content-type") || "").includes(
          requestConfig.DOH_CONTENT_TYPE,
        )
      )
        return new Response("Unsupported Media Type", { status: 415 });
      try {
        rawQueryBuffer = await incomingRequest.arrayBuffer();
        if (rawQueryBuffer.byteLength > requestConfig.MAX_POST_BODY_BYTES)
          return new Response("Payload Too Large", { status: 413 });
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
    } else {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (rawQueryBuffer.byteLength < DNS_CONSTANTS.HEADER_LEN)
      return new Response("Malformed DNS Query", { status: 400 });

    const transactionIdByteArray = new Uint8Array(rawQueryBuffer.slice(0, 2));
    const resolvedClientIp = normalizeClientIp(
      incomingRequest.headers.get("cf-connecting-ip"),
      requestConfig.FALLBACK_ECS_IP,
    );
    const hasClientEcs =
      DnsPacketProcessor.verifyEcsOptionPresence(rawQueryBuffer);
    const processedQueryBuffer = DnsPacketProcessor.injectEcsPayload(
      rawQueryBuffer,
      resolvedClientIp,
      requestConfig.FALLBACK_ECS_IP,
    );
    const cacheKeyHex =
      DnsPacketProcessor.generateStableCacheKey(processedQueryBuffer);
    const probabilitySample = parseInt(cacheKeyHex.slice(-4), 16) % 10000;
    const currentTimestamp = Date.now();

    const memoryCacheEntry = primaryMemoryCache.get(
      cacheKeyHex,
      requestConfig.EXTREME_STALE_FALLBACK_MS,
    );
    if (memoryCacheEntry) {
      if (!memoryCacheEntry.hitTimestamps) {
        memoryCacheEntry.hitTimestamps = new Float64Array(
          requestConfig.HOT_HIT_THRESHOLD,
        );
        memoryCacheEntry.currentHitIndex = 0;
        memoryCacheEntry.totalHitCount = 0;
      }
      memoryCacheEntry.hitTimestamps[memoryCacheEntry.currentHitIndex] =
        currentTimestamp;
      memoryCacheEntry.currentHitIndex =
        (memoryCacheEntry.currentHitIndex + 1) %
        requestConfig.HOT_HIT_THRESHOLD;
      if (memoryCacheEntry.totalHitCount < requestConfig.HOT_HIT_THRESHOLD)
        memoryCacheEntry.totalHitCount++;

      if (currentTimestamp < memoryCacheEntry.expiryTimestamp) {
        const cacheAgeSeconds = Math.max(
          0,
          Math.floor(
            (memoryCacheEntry.expiryTimestamp - currentTimestamp) / 1000,
          ),
        );
        return this.createResponse(
          memoryCacheEntry.payloadByteArray,
          transactionIdByteArray,
          hasClientEcs,
          cacheAgeSeconds,
          "HIT-L1",
          cacheKeyHex,
          requestConfig,
        );
      }

      const staleWindowMilliseconds = Math.floor(
        (memoryCacheEntry.expiryTimestamp -
          (memoryCacheEntry.storedTimestamp ||
            memoryCacheEntry.expiryTimestamp)) *
          requestConfig.STALE_WINDOW_FACTOR,
      );
      if (
        currentTimestamp <
        memoryCacheEntry.expiryTimestamp + staleWindowMilliseconds
      ) {
        if (!requestCoalescingMap.has(cacheKeyHex)) {
          executionContext.waitUntil(
            this.resolveUpstream(
              processedQueryBuffer,
              cacheKeyHex,
              probabilitySample,
              true,
              null,
              null,
              requestConfig,
            ).catch(() => {}),
          );
        }
        return this.createResponse(
          memoryCacheEntry.payloadByteArray,
          transactionIdByteArray,
          hasClientEcs,
          0,
          "HIT-L1-STALE",
          cacheKeyHex,
          requestConfig,
        );
      }
    }

    const globalCacheRequestUrl = new Request(
      `${requestConfig.GLOBAL_CACHE_NAMESPACE}${cacheKeyHex}`,
    );
    if (probabilitySample < requestConfig.CF_CACHE_WRITE_THRESHOLD) {
      try {
        const globalCacheResponse = await caches.default.match(
          globalCacheRequestUrl,
        );
        if (globalCacheResponse && globalCacheResponse.ok) {
          const responseArrayBuffer = await globalCacheResponse.arrayBuffer();
          if (
            responseArrayBuffer.byteLength <= requestConfig.MAX_CACHEABLE_BYTES
          ) {
            const payloadByteArray = new Uint8Array(responseArrayBuffer);
            const ttlFromHeader = Number(
              globalCacheResponse.headers.get("X-DOHFLARE-Original-TTL") ||
                requestConfig.DEFAULT_POSITIVE_TTL,
            );
            primaryMemoryCache.set(
              cacheKeyHex,
              {
                payloadByteArray: payloadByteArray,
                expiryTimestamp: Date.now() + ttlFromHeader * 1000,
                payloadSize: payloadByteArray.byteLength,
                lastGlobalWriteTimestamp: Date.now(),
                storedTimestamp: Date.now(),
              },
              requestConfig.EXTREME_STALE_FALLBACK_MS,
            );
            return this.createResponse(
              payloadByteArray,
              transactionIdByteArray,
              hasClientEcs,
              ttlFromHeader,
              "HIT-L2-GLOBAL",
              cacheKeyHex,
              requestConfig,
            );
          }
        }
      } catch (error) {
        /* Background degradation handling */
      }
    }

    if (requestCoalescingMap.has(cacheKeyHex)) {
      try {
        const coalescedResult = await requestCoalescingMap.get(cacheKeyHex);
        return this.createResponse(
          coalescedResult.payloadByteArray,
          transactionIdByteArray,
          hasClientEcs,
          coalescedResult.jitteredTtl,
          "MISS-COALESCED",
          cacheKeyHex,
          requestConfig,
          coalescedResult.httpStatus,
        );
      } catch (error) {
        /* Coalescing fallback triggers internal miss */
      }
    }

    let promiseResolver = (value) => {};
    let promiseRejecter = (reason) => {};
    const upstreamFetchPromise = new Promise((resolve, reject) => {
      promiseResolver = resolve;
      promiseRejecter = reject;
    });
    requestCoalescingMap.set(cacheKeyHex, upstreamFetchPromise);

    try {
      const resolutionResult = await this.resolveUpstream(
        processedQueryBuffer,
        cacheKeyHex,
        probabilitySample,
        false,
        executionContext,
        globalCacheRequestUrl,
        requestConfig,
      );
      promiseResolver(resolutionResult);
      return this.createResponse(
        resolutionResult.payloadByteArray,
        transactionIdByteArray,
        hasClientEcs,
        resolutionResult.jitteredTtl,
        "MISS",
        cacheKeyHex,
        requestConfig,
        resolutionResult.httpStatus || 200,
        {
          "X-DOHFLARE-Write-Decision": resolutionResult.cacheWriteDecision,
          "X-DOHFLARE-RCODE": String(resolutionResult.responseCode || 0),
        },
      );
    } catch (resolutionError) {
      promiseRejecter(resolutionError);
      const staleCacheEntry = primaryMemoryCache.peek(cacheKeyHex);
      if (staleCacheEntry && staleCacheEntry.payloadByteArray) {
        return this.createResponse(
          staleCacheEntry.payloadByteArray,
          transactionIdByteArray,
          hasClientEcs,
          0,
          "HIT-L1-STALE-FALLBACK",
          cacheKeyHex,
          requestConfig,
          200,
          { "X-DOHFLARE-Degraded": "1" },
        );
      }
      return new Response("Bad Gateway", {
        status: 502,
        headers: { "X-DOHFLARE-Code": "UPSTREAM_ERR" },
      });
    } finally {
      requestCoalescingMap.delete(cacheKeyHex);
    }
  }

  static async resolveUpstream(
    processedQueryBuffer,
    cacheKeyHex,
    probabilitySample,
    isBackgroundExecution,
    executionContext,
    globalCacheRequestUrl,
    requestConfig,
  ) {
    let internalResolutionError = null;
    const maxAttempts = requestConfig.MAX_RETRIES + 1;
    const urlsCount = requestConfig.UPSTREAM_URLS.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const targetUrl = requestConfig.UPSTREAM_URLS[attempt % urlsCount];

      try {
        return await this.fetchUpstream(
          targetUrl,
          processedQueryBuffer,
          cacheKeyHex,
          probabilitySample,
          isBackgroundExecution,
          executionContext,
          globalCacheRequestUrl,
          requestConfig,
        );
      } catch (error) {
        internalResolutionError = error;
      }
    }
    throw internalResolutionError || new Error(ERRORS.TIMEOUT);
  }

  static async fetchUpstream(
    upstreamUrlEndpoint,
    processedQueryBuffer,
    cacheKeyHex,
    probabilitySample,
    isBackgroundExecution,
    executionContext,
    globalCacheRequestUrl,
    requestConfig,
  ) {
    const upstreamResponse = await executeFetchWithTimeout(
      upstreamUrlEndpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": requestConfig.DOH_CONTENT_TYPE,
          Accept: requestConfig.DOH_CONTENT_TYPE,
        },
        body: processedQueryBuffer,
      },
      requestConfig.FETCH_TIMEOUT_MS,
    );
    if (!upstreamResponse.ok)
      throw new Error(`Upstream HTTP ${upstreamResponse.status}`);
    const responseArrayBuffer = await upstreamResponse.arrayBuffer();
    if (responseArrayBuffer.byteLength > requestConfig.MAX_CACHEABLE_BYTES)
      throw new Error(ERRORS.OVERSIZED);

    const payloadByteArray = new Uint8Array(responseArrayBuffer);
    const { extractedTtl, responseCode } =
      DnsPacketProcessor.extractTtlAndResponseCode(
        responseArrayBuffer,
        requestConfig.DEFAULT_POSITIVE_TTL,
      );
    const effectiveTtlValue =
      responseCode === DNS_CONSTANTS.RCODE_NXDOMAIN
        ? requestConfig.DEFAULT_NEGATIVE_TTL
        : extractedTtl;
    const jitteredTtl = Math.max(
      1,
      Math.floor(
        effectiveTtlValue *
          this.calculateDeterministicJitter(
            cacheKeyHex,
            requestConfig.JITTER_PCT,
          ),
      ),
    );
    primaryMemoryCache.set(
      cacheKeyHex,
      {
        payloadByteArray: payloadByteArray,
        expiryTimestamp: Date.now() + jitteredTtl * 1000,
        payloadSize: payloadByteArray.byteLength,
        storedTimestamp: Date.now(),
      },
      requestConfig.EXTREME_STALE_FALLBACK_MS,
    );

    let cacheWriteDecision = "SKIP";
    if (!isBackgroundExecution && executionContext && globalCacheRequestUrl) {
      const existingCacheEntry = primaryMemoryCache.peek(cacheKeyHex);
      let forceHotWrite = false;
      if (
        existingCacheEntry &&
        existingCacheEntry.totalHitCount === requestConfig.HOT_HIT_THRESHOLD
      ) {
        if (
          Date.now() -
            existingCacheEntry.hitTimestamps[
              existingCacheEntry.currentHitIndex
            ] <=
          requestConfig.HOT_WINDOW_MS
        )
          forceHotWrite = true;
      }

      if (
        probabilitySample < requestConfig.CF_CACHE_WRITE_THRESHOLD ||
        forceHotWrite
      ) {
        const lastGlobalWriteTimestamp = existingCacheEntry
          ? existingCacheEntry.lastGlobalWriteTimestamp || 0
          : 0;
        if (
          Date.now() - lastGlobalWriteTimestamp >
            requestConfig.GLOBAL_WRITE_COOLDOWN_MS &&
          this.checkWriteRateLimit(requestConfig)
        ) {
          if (!activeGlobalWriteLocks.has(cacheKeyHex)) {
            activeGlobalWriteLocks.add(cacheKeyHex);
            try {
              const globalMatchResult = await caches.default.match(
                globalCacheRequestUrl,
              );
              if (!globalMatchResult) {
                const globalCacheHeaders = new Headers({
                  "Content-Type": requestConfig.DOH_CONTENT_TYPE,
                  "Cache-Control": `public, max-age=${jitteredTtl}`,
                  "X-DOHFLARE-Original-TTL": String(jitteredTtl),
                });
                if (existingCacheEntry)
                  existingCacheEntry.lastGlobalWriteTimestamp = Date.now();
                executionContext.waitUntil(
                  caches.default
                    .put(
                      globalCacheRequestUrl,
                      new Response(payloadByteArray.slice(0), {
                        status: 200,
                        headers: globalCacheHeaders,
                      }),
                    )
                    .catch(() => {}),
                );
                cacheWriteDecision = forceHotWrite
                  ? "WRITE-FORCE"
                  : "WRITE-SCHEDULED";
              } else {
                cacheWriteDecision = "ALREADY-PRESENT";
                if (existingCacheEntry)
                  existingCacheEntry.lastGlobalWriteTimestamp = Date.now();
              }
            } catch {
              cacheWriteDecision = "GLOBAL-CHECK-ERR";
            } finally {
              activeGlobalWriteLocks.delete(cacheKeyHex);
            }
          } else {
            cacheWriteDecision = "WRITE-LOCKED";
          }
        } else {
          cacheWriteDecision = "COOLDOWN-OR-RATE-LIMIT";
        }
      }
    }
    return {
      payloadByteArray,
      httpStatus: upstreamResponse.status,
      jitteredTtl,
      cacheWriteDecision,
      responseCode,
    };
  }
}

/* ==========================================================================
   7. WORKER ENTRY POINT
   ========================================================================== */
export default {
  async fetch(incomingRequest, environmentVariables, executionContext) {
    try {
      return await DoHRequestHandler.processIncomingRequest(
        incomingRequest,
        environmentVariables,
        executionContext,
      );
    } catch (criticalError) {
      return new Response("Internal Server Error", {
        status: 500,
        headers: { "X-DOHFLARE-Code": "INTERNAL_FATAL" },
      });
    }
  },
};
