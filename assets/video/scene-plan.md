# ATV Design Landing Hero — Scene Plan

**Total Duration:** 74 seconds  
**Total Words:** 180 (~2.4 words per second)  
**Narrator Voice:** af_bella

| # | Time (s) | Visual (HTML/GSAP) | VO Line Snippet | Duration |
|----|----------|--------------------|--------------------|----------|
| 1 | 0–3 | Black background. ATV Design wordmark + lockup (text + icon) center-fade in over 1.2s. Subtle radial glow (CSS `radial-gradient`) pulses gently for atmosphere. GitHub Copilot logomark appears to the right of wordmark at 1.5s with a soft `stroke-dasharray` connecting line drawn between them in 0.8s. | "Your GitHub Copilot subscription. Your laptop. Real design artifacts." | 3.0 |
| 2 | 3–13 | Clean transition: wordmark + logos slide down-left to upper-left corner (0.4s ease-out). Center stage fills with a stylized laptop frame (HTML div, 800×500px, light border). Inside the laptop, a prompt input field appears fade-in (1s). Cursor blinks. | "Meet ATV Design—an open-source AI agent that turns your design prompts into HTML, JSX, and slides. No web accounts. No API handshakes." | 10.0 |
| 3 | 13–23 | Inside laptop frame: user types "SaaS landing page hero" in the prompt field (simulated keystroke animation, 2s). A "Generate" button glows and becomes clickable. User cursor clicks (visual ripple effect). Prompt field dims slightly. A spinner appears (rotating icon, 1.5s). | "Just Copilot, connected locally via OAuth, generating the prototypes you need. Imagine: you describe a SaaS landing page hero. You hit generate." | 10.0 |
| 4 | 23–35 | Spinner fades. Inside laptop frame: a live SaaS hero section renders progressively: gradient background (1s), headline text fade-in (0.5s), CTA button appears (0.5s), hero image / illustration slide-in from right (1.5s). All contained within the laptop frame. Clean, modern design visible. | "And… there it is. A live, interactive prototype. Right on your machine." | 12.0 |
| 5 | 35–45 | Laptop frame remains center. Three action buttons appear below the rendered hero: "Tweak Layout" (left), "Adjust Colors" (center), "Export" (right). Each button has a subtle pulse animation. When "Export" is hovered/clicked, a dropdown menu slides down showing: "HTML", "React JSX", "PDF". Each exports with a brief checkmark animation. | "Tweak the layout. Adjust the colors. Export it as a web component, a React JSX file, or a PDF—all without leaving your workspace." | 10.0 |
| 6 | 45–57 | Laptop frame slides left (0.6s). Right side of screen opens: three provider logos arranged vertically (Copilot highlight at top with a slight glow, then Claude, GPT, Gemini, Ollama below—smaller, monochrome). A toggle or checkbox appears next to Copilot: "Default." Local file icon appears bottom-right (hard drive / folder icon, pulse 2x). | "ATV Design works with Copilot out of the box. Plus Claude, GPT, Gemini, and Ollama if you prefer. It's local-first. No subscriptions. No tracking." | 12.0 |
| 7 | 57–67 | Fade to clean white background. Large text center-stage, appearing word-by-word: "Your designs." (1s fade-in) → "Your credentials." (1s fade-in) → "Your rules." (1s fade-in). Between each phrase, subtle accent lines or icons slide in from sides (briefcase, lock, checkmark). | "Your designs, your credentials, your rules." | 10.0 |
| 8 | 67–74 | Final scene: dark background returns. GitHub-style open-source badge (orange/red) animates in center-top (0.5s scale bounce). Below it, text appears: "MIT-Licensed" (0.5s fade-in), "Open Source" (0.5s fade-in). At bottom, prominent CTA button: "Run it Locally Today" glows and pulses gently. ATV Design logo small in bottom-right corner. | "Open source. MIT-licensed. Run it locally today." | 7.0 |

---

## Notes

- **Timing:** Scenes sum to 74s, matching ~180 words at ~2.4 wpm.
- **Emoji / Complexity:** Scenes 4 and 5 (the live render + interaction demo) are the most technically challenging—they require either pre-rendered SVG/image assets or a simplified DOM mock-render. HTML5 Canvas or Lottie JSON animation could substitute if GSAP DOM animation proves expensive.
- **Audio Sync:** VO script uses natural pauses (ellipses, em-dashes) to align with visual transitions. Kokoro TTS will respect punctuation pacing automatically.
- **Brand Consistency:** All scenes use ATV Design wordmark, GitHub Copilot branding (licensed), and a clean, modern design aesthetic matching the app itself.
