import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import type { GunDef } from "../../../shared/defs/gameObjects/gunDefs";
import {
    emptyStartingGuns,
    normalizeStartingGuns,
    type PrivateLobbyStartingGuns,
    StartingGunCategories,
    StartingGunMaxPerSlot,
    type StartingGunSlot,
    StartingGunSlots,
} from "../../../shared/defs/startingGuns";

const SlotInfo: Record<StartingGunSlot, { name: string; tag: string }> = {
    primary: { name: "Primary", tag: "PRI" },
    secondary: { name: "Secondary", tag: "SEC" },
};

function gunDef(gun: string) {
    return GameObjectDefs[gun] as GunDef | undefined;
}

export function startingGunName(gun: string) {
    return gunDef(gun)?.name ?? gun;
}

function gunIconUrl(gun: string) {
    const sprite = gunDef(gun)?.lootImg.sprite ?? "";
    return `/img/loot/${sprite.replace(".img", ".svg")}`;
}

function slotStatus(count: number) {
    return count > 1 ? "Random" : "";
}

export function describeStartingGuns(guns: PrivateLobbyStartingGuns | undefined) {
    const { primary, secondary } = normalizeStartingGuns(guns);
    if (!primary.length && !secondary.length) return "Guns: Default";
    if (primary.length > 1 || secondary.length > 1) return "Guns: Random";
    return "Guns: Set";
}

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export class StartingGunsPicker {
    private root: HTMLDivElement;
    private panel: HTMLDivElement;
    private traysEl: HTMLDivElement;
    private tabsEl: HTMLDivElement;
    private gridEl: HTMLDivElement;
    private pickerEl: HTMLDivElement;
    private lockedEl: HTMLDivElement;
    private clearBtn: HTMLButtonElement;
    private guns = emptyStartingGuns();
    private activeCategory: string = StartingGunCategories[0].id;
    private drag?: {
        gun: string;
        fromSlot?: StartingGunSlot;
        pointerId: number;
        startX: number;
        startY: number;
        ghost?: HTMLDivElement;
        holdTimer?: number;
        overSlot?: StartingGunSlot;
    };

    constructor(
        private readonly opts: {
            getGuns: () => PrivateLobbyStartingGuns | undefined;
            canEdit: () => boolean;
            onChange: (guns: PrivateLobbyStartingGuns) => void;
        },
    ) {
        this.root = el("div", "starting-guns-overlay");
        this.root.setAttribute("role", "dialog");
        this.root.setAttribute("aria-modal", "true");
        this.root.setAttribute("aria-label", "Starting guns");

        this.panel = el("div", "starting-guns-panel");

        const header = el("div", "modal-header starting-guns-header");
        const closeBtn = el("span", "close close-corner");
        closeBtn.setAttribute("role", "button");
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.addEventListener("click", () => this.close());
        header.append(closeBtn, el("h2", undefined, "Starting Guns"));

        const body = el("div", "modal-body starting-guns-body");

        this.traysEl = el("div", "starting-guns-trays");

        this.pickerEl = el("div", "starting-guns-picker");
        this.tabsEl = el("div", "starting-guns-tabs");
        this.gridEl = el("div", "starting-guns-grid");
        this.pickerEl.append(this.tabsEl, this.gridEl);

        this.lockedEl = el(
            "div",
            "starting-guns-locked",
            "Only the lobby owner can change starting guns.",
        );

        const footer = el("div", "modal-footer modal-footer-round starting-guns-footer");
        this.clearBtn = el("button", "starting-guns-clear btn-darken", "Clear");
        this.clearBtn.type = "button";
        this.clearBtn.addEventListener("click", () => this.commit(emptyStartingGuns()));
        const doneBtn = el("button", "starting-guns-done btn-green btn-darken", "Done");
        doneBtn.type = "button";
        doneBtn.addEventListener("click", () => this.close());
        footer.append(this.clearBtn, doneBtn);

        body.append(this.traysEl, this.pickerEl, this.lockedEl);
        this.panel.append(header, body, footer);
        this.root.append(this.panel);

        this.root.addEventListener("mousedown", (e) => {
            if (e.target === this.root) this.close();
        });
        window.addEventListener(
            "keydown",
            (e) => {
                if (e.key === "Escape" && this.isOpen) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    this.close();
                }
            },
            true,
        );

        document.body.append(this.root);
    }

    get isOpen() {
        return this.root.classList.contains("open");
    }

    open() {
        this.guns = normalizeStartingGuns(this.opts.getGuns());
        this.render();
        this.root.classList.add("open");
    }

    close() {
        this.endDrag();
        this.root.classList.remove("open");
    }

    refresh() {
        if (!this.isOpen) return;
        this.guns = normalizeStartingGuns(this.opts.getGuns());
        this.render();
    }

    private commit(guns: PrivateLobbyStartingGuns) {
        if (!this.opts.canEdit()) return;
        this.guns = normalizeStartingGuns(guns);
        this.opts.onChange(this.guns);
        this.render();
    }

    private removeGun(slot: StartingGunSlot, gun: string) {
        this.commit({
            ...this.guns,
            [slot]: this.guns[slot].filter((g) => g !== gun),
        });
    }

    private render() {
        const canEdit = this.opts.canEdit();
        this.panel.classList.toggle("read-only", !canEdit);
        this.pickerEl.hidden = !canEdit;
        this.lockedEl.hidden = canEdit;
        this.clearBtn.hidden = !canEdit;
        this.clearBtn.disabled = !this.guns.primary.length && !this.guns.secondary.length;
        this.renderTrays(canEdit);
        if (canEdit) {
            this.renderTabs();
            this.renderGrid();
        }
    }

    private renderTrays(canEdit: boolean) {
        this.traysEl.replaceChildren();
        for (const slot of StartingGunSlots) {
            const list = this.guns[slot];
            const tray = el("div", "starting-guns-tray");
            tray.dataset.slot = slot;

            const label = el("div", "starting-guns-tray-label");
            label.append(
                el("span", "starting-guns-tray-name", SlotInfo[slot].name),
                el("span", "starting-guns-tray-status", slotStatus(list.length)),
            );

            const items = el("div", "starting-guns-tray-items");
            for (const gun of list) {
                const chip = el("div", "starting-guns-chip");
                chip.title = startingGunName(gun);
                const img = el("img");
                img.src = gunIconUrl(gun);
                img.alt = "";
                img.draggable = false;
                chip.append(
                    img,
                    el("span", "starting-guns-chip-name", startingGunName(gun)),
                );
                if (canEdit) {
                    this.makeDraggable(chip, gun, slot);
                    const remove = el("button", "starting-guns-chip-remove");
                    remove.type = "button";
                    remove.setAttribute("aria-label", `Remove ${startingGunName(gun)}`);
                    remove.addEventListener("click", (e) => {
                        e.stopPropagation();
                        this.removeGun(slot, gun);
                    });
                    chip.append(remove);
                }
                items.append(chip);
            }
            if (list.length === 0) {
                items.append(
                    el(
                        "div",
                        "starting-guns-tray-empty",
                        canEdit ? "Drag guns here" : "Normal spawn",
                    ),
                );
            }

            tray.append(label, items);
            this.traysEl.append(tray);
        }
    }

    private renderTabs() {
        this.tabsEl.replaceChildren();
        for (const category of StartingGunCategories) {
            const tab = el("button", "starting-guns-tab", category.name);
            tab.type = "button";
            tab.classList.toggle("active", category.id === this.activeCategory);
            tab.addEventListener("click", () => {
                this.activeCategory = category.id;
                this.renderTabs();
                this.renderGrid();
            });
            this.tabsEl.append(tab);
        }
    }

    private renderGrid() {
        this.gridEl.replaceChildren();
        const category =
            StartingGunCategories.find((c) => c.id === this.activeCategory) ??
            StartingGunCategories[0];
        for (const gun of category.guns) {
            const tile = el("div", "starting-guns-tile");
            tile.title = startingGunName(gun);
            const img = el("img");
            img.src = gunIconUrl(gun);
            img.alt = "";
            img.draggable = false;
            tile.append(img, el("span", "starting-guns-tile-name", startingGunName(gun)));
            const tags = el("div", "starting-guns-tile-tags");
            for (const slot of StartingGunSlots) {
                if (!this.guns[slot].includes(gun)) continue;
                const tag = el("span", "starting-guns-tile-tag", SlotInfo[slot].tag);
                tag.dataset.slot = slot;
                tags.append(tag);
            }
            if (tags.childElementCount) {
                tile.classList.add("picked");
                tile.append(tags);
            }
            this.makeDraggable(tile, gun);
            this.gridEl.append(tile);
        }
    }

    private makeDraggable(node: HTMLElement, gun: string, fromSlot?: StartingGunSlot) {
        node.addEventListener("contextmenu", (e) => e.preventDefault());
        node.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 || this.drag) return;
            if ((e.target as HTMLElement).closest(".starting-guns-chip-remove")) return;
            this.drag = {
                gun,
                fromSlot,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
            };
            if (e.pointerType === "touch") {
                this.drag.holdTimer = window.setTimeout(() => {
                    if (this.drag) this.beginDrag(e.clientX, e.clientY);
                }, 220);
            }
            window.addEventListener("pointermove", this.onPointerMove);
            window.addEventListener("pointerup", this.onPointerUp);
            window.addEventListener("pointercancel", this.onPointerCancel);
            window.addEventListener("touchmove", this.onTouchMove, { passive: false });
        });
    }

    private beginDrag(x: number, y: number) {
        const drag = this.drag;
        if (!drag || drag.ghost) return;
        window.clearTimeout(drag.holdTimer);
        const ghost = el("div", "starting-guns-ghost");
        const img = el("img");
        img.src = gunIconUrl(drag.gun);
        img.alt = "";
        ghost.append(img);
        document.body.append(ghost);
        drag.ghost = ghost;
        this.panel.classList.add("dragging");
        this.moveGhost(x, y);
    }

    private moveGhost(x: number, y: number) {
        const drag = this.drag;
        if (!drag?.ghost) return;
        drag.ghost.style.transform = `translate(${x}px, ${y}px)`;
        const tray = document
            .elementFromPoint(x, y)
            ?.closest<HTMLElement>(".starting-guns-tray");
        const overSlot =
            tray && this.traysEl.contains(tray)
                ? (tray.dataset.slot as StartingGunSlot)
                : undefined;
        if (overSlot === drag.overSlot) return;
        drag.overSlot = overSlot;
        for (const node of Array.from(this.traysEl.children)) {
            const slot = (node as HTMLElement).dataset.slot;
            node.classList.toggle("drop-target", !!overSlot && slot === overSlot);
        }
    }

    private onPointerMove = (e: PointerEvent) => {
        const drag = this.drag;
        if (!drag || e.pointerId !== drag.pointerId) return;
        if (!drag.ghost) {
            const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
            if (e.pointerType === "touch") {
                if (moved > 10) this.endDrag();
                return;
            }
            if (moved < 5) return;
            this.beginDrag(e.clientX, e.clientY);
        }
        this.moveGhost(e.clientX, e.clientY);
    };

    private onTouchMove = (e: TouchEvent) => {
        if (this.drag?.ghost) e.preventDefault();
    };

    private onPointerUp = (e: PointerEvent) => {
        const drag = this.drag;
        if (!drag || e.pointerId !== drag.pointerId) return;
        const dropped = !!drag.ghost;
        const { gun, fromSlot, overSlot } = drag;
        this.endDrag();
        if (!dropped || overSlot === fromSlot) return;

        const next = {
            primary: [...this.guns.primary],
            secondary: [...this.guns.secondary],
        };
        if (fromSlot) next[fromSlot] = next[fromSlot].filter((g) => g !== gun);
        if (overSlot) {
            if (next[overSlot].includes(gun)) {
                if (!fromSlot) return;
            } else if (next[overSlot].length >= StartingGunMaxPerSlot) {
                return;
            } else {
                next[overSlot].push(gun);
            }
        }
        this.commit(next);
    };

    private onPointerCancel = (e: PointerEvent) => {
        if (this.drag && e.pointerId === this.drag.pointerId) this.endDrag();
    };

    private endDrag() {
        const drag = this.drag;
        if (!drag) return;
        window.clearTimeout(drag.holdTimer);
        drag.ghost?.remove();
        this.drag = undefined;
        this.panel.classList.remove("dragging");
        for (const node of Array.from(this.traysEl.children))
            node.classList.remove("drop-target");
        window.removeEventListener("pointermove", this.onPointerMove);
        window.removeEventListener("pointerup", this.onPointerUp);
        window.removeEventListener("pointercancel", this.onPointerCancel);
        window.removeEventListener("touchmove", this.onTouchMove);
    }
}
