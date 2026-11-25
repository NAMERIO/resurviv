import $ from "jquery";
import { createLootPreview } from "../helpers";

const SLOT_COUNT = 5;
const ANGLE_STEP = (Math.PI * 2) / SLOT_COUNT;
const SPIN_DURATION_MS = 6000;
const MIN_SPIN_STEPS = SLOT_COUNT * 3;
const RADIUS_X = 165;
const RADIUS_Z = 110;
const PARTICLE_COUNT = 16;
const PARTICLE_LIFETIME_MS = 950;

function createMysteryImage() {
    return $("<img>", {
        src: "img/mystery-cosmetic.png",
        alt: "Mystery Cosmetic",
        class: "vault-mystery-image",
    });
}

export class VaultWheelCarousel {
    slots: JQuery<HTMLElement>[] = [];
    rotation = 0;
    frameId: number | null = null;
    shownReward: string | null = null;

    constructor(
        readonly stage: JQuery<HTMLElement>,
        readonly container: JQuery<HTMLElement>,
    ) {
        for (let i = 0; i < SLOT_COUNT; i++) {
            const slot = $("<div>").addClass("vault-mystery-skin");
            container.append(slot);
            this.slots.push(slot);
        }
        this.clearReward();
        this.layout();
    }

    get spinning() {
        return this.frameId !== null;
    }

    getFrontSlot() {
        const index = (-Math.round(this.rotation / ANGLE_STEP) % SLOT_COUNT) + SLOT_COUNT;
        return this.slots[index % SLOT_COUNT];
    }

    layout() {
        this.slots.forEach((slot, i) => {
            const angle = i * ANGLE_STEP + this.rotation;
            const x = Math.sin(angle) * RADIUS_X;
            const z = Math.cos(angle) * RADIUS_Z;
            const scale = 0.85 + ((z + RADIUS_Z) / (RADIUS_Z * 2)) * 0.45;
            slot.css({
                transform: `translate3d(${x}px, 0, ${z}px) scale(${scale})`,
                zIndex: Math.round(z + RADIUS_Z),
            });
        });
    }

    spin(onDone: () => void) {
        if (this.spinning) return;

        this.clearReward();

        const startRotation = this.rotation;
        const steps = MIN_SPIN_STEPS + Math.floor(Math.random() * SLOT_COUNT);
        const targetRotation =
            Math.round(startRotation / ANGLE_STEP) * ANGLE_STEP + steps * ANGLE_STEP;
        const startTime = performance.now();

        const tick = (now: number) => {
            const t = Math.min((now - startTime) / SPIN_DURATION_MS, 1);
            const eased = 1 - (1 - t) ** 3;
            this.rotation = startRotation + (targetRotation - startRotation) * eased;
            this.layout();

            if (t < 1) {
                this.frameId = requestAnimationFrame(tick);
                return;
            }

            this.frameId = null;
            onDone();
        };

        this.frameId = requestAnimationFrame(tick);
    }

    showReward(reward: string, celebrate: boolean) {
        if (this.shownReward === reward) return;

        this.clearReward();
        this.shownReward = reward;

        this.getFrontSlot()
            .addClass("vault-winner")
            .empty()
            .append(
                $("<div>")
                    .addClass("vault-wheel-winner-display")
                    .toggleClass("vault-wheel-restored", !celebrate)
                    .append(
                        createLootPreview(reward, "vault-wheel-reward", {
                            outfitScale: 1.2,
                        }),
                    ),
            );

        if (celebrate) this.burstParticles();
    }

    clearReward() {
        this.shownReward = null;
        for (const slot of this.slots) {
            slot.removeClass("vault-winner").empty().append(createMysteryImage());
        }
    }

    burstParticles() {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
            const distance = 65 + Math.random() * 45;
            const particle = $("<div>")
                .addClass("vault-reward-particle")
                .css({
                    "--dx": `${Math.cos(angle) * distance}px`,
                    "--dy": `${Math.sin(angle) * distance}px`,
                });
            this.stage.append(particle);
            window.setTimeout(() => particle.remove(), PARTICLE_LIFETIME_MS);
        }
    }
}
