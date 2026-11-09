import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { ParticleBarn } from "../objects/particles";

const REVEAL_MS = 5000;
const SPARK_COUNT = 18;

let activeReveal: HTMLElement | null = null;

export function burstFreeFallTicket(
    particleBarn: ParticleBarn,
    pos: Vec2,
    layer: number,
) {
    particleBarn.addParticle("freeFallGlow", layer, pos, v2.create(0, 3));
    particleBarn.addParticle("freeFallTicket", layer, pos, v2.create(0, 6), 1, 0);
    for (let i = 0; i < SPARK_COUNT; i++) {
        const speed = 7 + Math.random() * 9;
        particleBarn.addParticle(
            "freeFallSpark",
            layer,
            pos,
            v2.mul(v2.randomUnit(), speed),
        );
    }
}

export function showFreeFallTicketReveal() {
    activeReveal?.remove();

    const root = document.createElement("div");
    root.className = "ff-reveal";
    root.setAttribute("role", "status");
    root.innerHTML = `
        <div class="ff-reveal__title">YOU GOT</div>
        <div class="ff-reveal__name">Free Fall Ticket</div>
        <div class="ff-reveal__item">
            <div class="ff-reveal__spinner"></div>
            <img class="ff-reveal__ticket" src="/img/loot/loot-free-fall-ticket.svg" alt="" />
        </div>
        <div class="ff-reveal__sub">Free shop until Jan 1, 2027</div>`;

    document.body.appendChild(root);
    activeReveal = root;

    window.setTimeout(() => {
        root.remove();
        if (activeReveal === root) activeReveal = null;
    }, REVEAL_MS);
}
