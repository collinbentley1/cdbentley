/**
 * Provenance character-packets (WS-C Phase C) — receipts swim in from
 * consistent edges and dock beside their claims: yale.edu from the LEFT
 * rail, GitHub/commits/live endpoints from BELOW, press from the RIGHT.
 * Where knowledge comes from, taught by where it swims in from.
 *
 * Accessibility: the packet is pure decoration (aria-hidden). The receipt
 * chip itself is real DOM in reading order, keyboard-focusable; focusing a
 * claim's chip triggers the same swim so keyboard users get the same
 * teaching moment. Reduced/plain mode renders chips statically, no motion.
 *
 * The ONE accent color fires here and only here — the epistemic event of a
 * receipt docking (theme accent; scenes never use it).
 */

import { OCEAN_THEME } from "../sdk/index.ts";

const PACKET_GLYPHS: Record<string, string> = {
  below: "░▒▓ ▓▒░",
  left: "≈~· yale.edu ·~≈",
  right: "≈~· press ·~≈",
};

export function bindProvenancePackets(root: ParentNode, motionEnabled: () => boolean): void {
  const claims = Array.from(root.querySelectorAll<HTMLElement>(".claim[data-edge]"));
  const swum = new WeakSet<HTMLElement>();

  const swim = (claim: HTMLElement): void => {
    if (!motionEnabled() || swum.has(claim)) {
      return;
    }

    swum.add(claim);
    const chip = claim.querySelector<HTMLElement>(".receipt-chip");
    const target = (chip ?? claim).getBoundingClientRect();
    const edge = claim.dataset["edge"] ?? "below";

    const packet = document.createElement("span");
    packet.className = "provenance-packet";
    packet.setAttribute("aria-hidden", "true");
    packet.textContent = edge === "below" ? PACKET_GLYPHS["below"] ?? "" : (PACKET_GLYPHS[edge] ?? "");
    document.body.append(packet);

    const targetX = target.x;
    const targetY = target.y + target.height / 2;
    let fromX = targetX;
    let fromY = targetY;

    if (edge === "left") {
      fromX = -240;
    } else if (edge === "right") {
      fromX = window.innerWidth + 240;
    } else {
      fromY = window.innerHeight + 120;
    }

    const animation = packet.animate(
      [
        { opacity: "0.9", transform: `translate(${fromX}px, ${fromY}px)` },
        { opacity: "1", transform: `translate(${targetX}px, ${targetY}px)` },
      ],
      { duration: 1200, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );

    animation.addEventListener("finish", () => {
      packet.remove();

      // The epistemic event: the receipt chip cures in the ONE accent, then
      // settles back to body ink (color transition lives in CSS).
      if (chip) {
        chip.style.color = OCEAN_THEME.accent;
        chip.style.borderColor = OCEAN_THEME.accent;
        window.setTimeout(() => {
          chip.style.color = "";
          chip.style.borderColor = "";
        }, 900);
      }
    });
  };

  const observer = new IntersectionObserver(
    (observedEntries) => {
      for (const entry of observedEntries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          swim(entry.target);
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.6 },
  );

  for (const claim of claims) {
    observer.observe(claim);
    // Keyboard/focus equivalent: focusing the chip swims the packet too.
    claim.querySelector<HTMLElement>(".receipt-chip")?.addEventListener("focus", () => {
      swim(claim);
    });
  }
}
