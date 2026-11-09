import ticketArt from "./ticket.svg?raw";

const REVEAL_MS = 7200;

const chuteArt = `
<svg viewBox="-56 -56 112 130" aria-hidden="true">
  <path d="M-50 2C-50-34-24-50 0-50S50-34 50 2C42-7 34-7 25 2 17-7 8-7 0 2-8-7-17-7-25 2-34-7-42-7-50 2Z" fill="#d8431b"/>
  <path d="M-25 2C-25-28-12-50 0-50S25-28 25 2C17-7 8-7 0 2-8-7-17-7-25 2Z" fill="#f2e7cf"/>
  <path d="M-50 2-6 70M-25 2-3 70M25 2 3 70M50 2 6 70" stroke="#f2e7cf" stroke-width="1.6" fill="none"/>
</svg>`;

let activeReveal: HTMLElement | null = null;

export function playFreeFallTicketReveal(finderName?: string) {
    activeReveal?.remove();

    const root = document.createElement("div");
    root.className = "ff-reveal";
    root.setAttribute("role", "status");
    root.innerHTML = `
        <div class="ff-reveal__rays"></div>
        <div class="ff-reveal__drop">
            <div class="ff-reveal__chute">${chuteArt}</div>
            <div class="ff-reveal__ticket">
                ${ticketArt}
                <div class="ff-reveal__sheen"></div>
            </div>
        </div>
        <div class="ff-reveal__caption">
            <div class="ff-reveal__title"></div>
            <div class="ff-reveal__sub">Everything in the shop is free until Jan 1, 2027</div>
        </div>`;

    root.querySelector(".ff-reveal__title")!.textContent = finderName
        ? `${finderName} pulled it for the squad`
        : "You pulled the Free Fall Ticket";

    document.body.appendChild(root);
    activeReveal = root;

    window.setTimeout(() => {
        root.remove();
        if (activeReveal === root) activeReveal = null;
    }, REVEAL_MS);
}
