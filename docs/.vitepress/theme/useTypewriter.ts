import { onMounted, onUnmounted } from "vue";

export function useTypewriter() {
  let timer;

  onMounted(() => {
    const el = document.getElementById("typed-text");
    if (!el) return;

    const words = ["Workers", "Pages"];
    let wordIndex = 0;
    let charIndex = words[0].length;
    let isDeleting = true;

    const type = () => {
      const currentWord = words[wordIndex];

      if (isDeleting) {
        charIndex--;
      } else {
        charIndex++;
      }

      el.textContent = currentWord.substring(0, charIndex);

      let typeSpeed = isDeleting ? 80 : 150;

      if (!isDeleting && charIndex === currentWord.length) {
        typeSpeed = 2500;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        typeSpeed = 500;
      }

      timer = setTimeout(type, typeSpeed);
    };

    timer = setTimeout(type, 2500);
  });

  onUnmounted(() => {
    clearTimeout(timer);
  });
}
