import base64 from "base64-js";
import $ from "jquery";
import { Input as GameInput, type Input } from "../../shared/gameConfig";
import { BitStream } from "../../shared/lib/bitBuffer";
import type { ConfigManager } from "./config";
import {
    GamepadButton,
    getGamepadButtonName,
    type InputHandler,
    InputType,
    InputValue,
    Key,
    MouseButton,
    MouseWheel,
} from "./input";
import { crc16 } from "./lib/crc";
import type { Localization } from "./ui/localization";

function def(name: string, defaultValue: InputValue | null) {
    return {
        name,
        defaultValue,
    };
}
function inputKey(key: Key) {
    return new InputValue(InputType.Key, key);
}
function mouseButton(button: MouseButton) {
    return new InputValue(InputType.MouseButton, button);
}
function mouseWheel(wheel: MouseWheel) {
    return new InputValue(InputType.MouseWheel, wheel);
}

const BindDefs = {
    [GameInput.MoveLeft]: def("Move Left", inputKey(Key.A)),
    [GameInput.MoveRight]: def("Move Right", inputKey(Key.D)),
    [GameInput.MoveUp]: def("Move Up", inputKey(Key.W)),
    [GameInput.MoveDown]: def("Move Down", inputKey(Key.S)),
    [GameInput.Fire]: def("Fire", mouseButton(MouseButton.Left)),
    [GameInput.Reload]: def("Reload", inputKey(Key.R)),
    [GameInput.Cancel]: def("Cancel", inputKey(Key.X)),
    [GameInput.Interact]: def("Interact", inputKey(Key.F)),
    [GameInput.Revive]: def("Revive", null),
    [GameInput.Use]: def("Open/Use", null),
    [GameInput.Loot]: def("Loot", null),
    [GameInput.EquipPrimary]: def("Equip Primary", inputKey(Key.One)),
    [GameInput.EquipSecondary]: def("Equip Secondary", inputKey(Key.Two)),
    [GameInput.EquipMelee]: def("Equip Melee", inputKey(Key.Three)),
    [GameInput.EquipThrowable]: def("Equip Throwable", inputKey(Key.Four)),
    [GameInput.EquipNextWeap]: def("Equip Next Weapon", mouseWheel(MouseWheel.Down)),
    [GameInput.EquipPrevWeap]: def("Equip Previous Weapon", mouseWheel(MouseWheel.Up)),
    [GameInput.EquipLastWeap]: def("Equip Last Weapon", inputKey(Key.Q)),
    [GameInput.StowWeapons]: def("Stow Weapons", inputKey(Key.E)),
    [GameInput.EquipPrevScope]: def("Equip Previous Scope", null),
    [GameInput.EquipNextScope]: def("Equip Next Scope", null),
    [GameInput.UseBandage]: def("Use Bandage", inputKey(Key.Seven)),
    [GameInput.UseHealthKit]: def("Use Med Kit", inputKey(Key.Eight)),
    [GameInput.UseSoda]: def("Use Soda", inputKey(Key.Nine)),
    [GameInput.UsePainkiller]: def("Use Pills", inputKey(Key.Zero)),
    [GameInput.UseNitroLace]: def("Use Nitro Lace", null),
    [GameInput.SwapWeapSlots]: def("Switch Gun Slots", inputKey(Key.T)),
    [GameInput.ActivateStreak]: def("Activate Streak", null),
    [GameInput.ToggleMap]: def("Toggle Map", inputKey(Key.M)),
    [GameInput.CycleUIMode]: def("Toggle Minimap", inputKey(Key.V)),
    [GameInput.EmoteMenu]: def("Emote Menu", mouseButton(MouseButton.Right)),
    [GameInput.TeamPingMenu]: def("Team Ping Hold", inputKey(Key.C)),
    [GameInput.EquipOtherGun]: def("Equip Other Gun", inputKey(Key.Space)),
    [GameInput.Fullscreen]: def("Full Screen", inputKey(Key.L)),
    [GameInput.HideUI]: def("Hide UI", null),
    [GameInput.TeamPingSingle]: def("Team Ping Menu", null),
};

const BindDisplayOrder = Object.keys(BindDefs)
    .map(Number)
    .filter(
        (bind) => bind !== GameInput.UseNitroLace && bind !== GameInput.ActivateStreak,
    )
    .concat(GameInput.UseNitroLace, GameInput.ActivateStreak);

// Standard Gamepad layout (Xbox names; PlayStation equivalents share these indices).
const GamepadBindDefaults: Partial<Record<Input, GamepadButton>> = {
    [GameInput.Fire]: GamepadButton.RightTrigger,
    [GameInput.Reload]: GamepadButton.X,
    [GameInput.Cancel]: GamepadButton.B,
    [GameInput.Interact]: GamepadButton.A,
    [GameInput.EquipMelee]: GamepadButton.LeftTrigger,
    [GameInput.EquipNextWeap]: GamepadButton.RightBumper,
    [GameInput.EquipOtherGun]: GamepadButton.LeftBumper,
    [GameInput.StowWeapons]: GamepadButton.LeftStick,
    [GameInput.UseBandage]: GamepadButton.DpadUp,
    [GameInput.UseHealthKit]: GamepadButton.DpadRight,
    [GameInput.UseSoda]: GamepadButton.DpadDown,
    [GameInput.UsePainkiller]: GamepadButton.DpadLeft,
    [GameInput.ToggleMap]: GamepadButton.Back,
    [GameInput.TeamPingSingle]: GamepadButton.RightStick,
};

const FixedGamepadLabels: Partial<Record<Input, string>> = {
    [GameInput.MoveLeft]: "Left Stick",
    [GameInput.MoveRight]: "Left Stick",
    [GameInput.MoveUp]: "Left Stick",
    [GameInput.MoveDown]: "Left Stick",
};

export class InputBinds {
    binds: Array<InputValue | null> = [];
    gamepadBinds: Array<GamepadButton | null> = [];
    boundKeys: Record<number, boolean | null> = {};
    menuHovered = false;

    constructor(
        public input: InputHandler,
        public config: ConfigManager,
    ) {
        this.input = input;
        this.config = config;
        this.loadBinds();
    }

    toArray() {
        const buf = new ArrayBuffer(GameInput.Count * 3 + 8);
        const stream = new BitStream(buf);
        stream.writeUint8(6);
        for (let i = 0; i < GameInput.Count; i++) {
            const bind = this.binds[i];
            const type = bind ? bind.type : 0;
            const code = bind ? bind.code : 0;
            stream.writeBits(type & 3, 2);
            stream.writeUint8(code & 255);
        }
        for (let i = 0; i < GameInput.Count; i++) {
            const bind = this.gamepadBinds[i];
            stream.writeBoolean(bind !== null && bind !== undefined);
            if (bind !== null && bind !== undefined) {
                stream.writeBits(bind, 5);
            }
        }
        // Append crc
        const data = new Uint8Array(buf, 0, stream.byteIndex);
        const checksum = crc16(data);
        const ret = new Uint8Array(data.length + 2);
        ret.set(data);
        ret[ret.length - 2] = (checksum >> 8) & 255;
        ret[ret.length - 1] = checksum & 255;
        return ret;
    }

    fromArray(buf: Uint8Array) {
        let data = new Uint8Array(buf);
        if (!data || data.length < 3) {
            return false;
        }
        // Check crc
        const dataCrc = (data[data.length - 2] << 8) | data[data.length - 1];
        data = data.slice(0, data.length - 2);
        if (crc16(data) != dataCrc) {
            return false;
        }
        const arrayBuf = new ArrayBuffer(data.length);
        const view = new Uint8Array(arrayBuf);
        for (let i = 0; i < data.length; i++) {
            view[i] = data[i];
        }
        const stream = new BitStream(arrayBuf);
        const version = stream.readUint8();
        this.clearAllBinds();
        const keyboardBindCount =
            version >= 2
                ? GameInput.Count
                : Math.floor((stream.length - stream.index) / 10);
        for (
            let bind = 0;
            bind < keyboardBindCount && stream.length - stream.index >= 10;
            bind++
        ) {
            const type = stream.readBits(2);
            const code = stream.readUint8();
            if (bind >= 0 && bind < GameInput.Count && type != InputType.None) {
                this.setBind(bind, type != 0 ? new InputValue(type, code) : null);
            }
        }
        if (version >= 2) {
            for (
                let bind = 0;
                bind < GameInput.Count && stream.length - stream.index >= 1;
                bind++
            ) {
                if (stream.readBoolean() && stream.length - stream.index >= 5) {
                    this.setGamepadBind(bind, stream.readBits(5) as GamepadButton);
                }
            }
        }
        if (version < 6) {
            this.upgradeBinds(version);
            this.saveBinds();
        }
        return true;
    }

    toBase64() {
        return base64.fromByteArray(this.toArray());
    }

    fromBase64(str: string) {
        let loaded = false;
        try {
            loaded = this.fromArray(base64.toByteArray(str));
        } catch (err) {
            console.error("Error", err);
        }
        return loaded;
    }

    saveBinds() {
        this.config.set("binds", this.toBase64());
    }

    loadBinds() {
        if (!this.fromBase64(this.config.get("binds") || "")) {
            this.loadDefaultBinds();
            this.saveBinds();
        }
    }

    upgradeBinds(version: number) {
        const newBinds: GameInput[] = [];

        // Set default inputs for the new binds, as long as those
        // defaults haven't already been used.

        for (let i = 0; i < newBinds.length; i++) {
            const bind = newBinds[i];
            const input = BindDefs[bind as keyof typeof BindDefs].defaultValue;
            const alreadyBound = false;
            for (let j = 0; j < this.binds.length; j++) {
                if (this.binds[j]?.equals(input!)) {
                    break;
                }
            }
            if (!alreadyBound) {
                this.setBind(bind, input);
            }
        }

        if (version < 2) {
            this.loadDefaultGamepadBinds();
        } else if (version < 3) {
            const newGamepadDefaults: Array<[Input, GamepadButton]> = [
                [GameInput.ToggleMap, GamepadButton.Back],
                [GameInput.TeamPingSingle, GamepadButton.RightStick],
            ];
            for (const [bind, button] of newGamepadDefaults) {
                if (
                    this.gamepadBinds[bind] === null &&
                    !this.gamepadBinds.includes(button)
                ) {
                    this.gamepadBinds[bind] = button;
                }
            }
        }
        if (
            version < 4 &&
            this.gamepadBinds[GameInput.EquipOtherGun] == GamepadButton.Y &&
            this.gamepadBinds[GameInput.StowWeapons] == GamepadButton.LeftStick
        ) {
            this.gamepadBinds[GameInput.EquipOtherGun] = GamepadButton.LeftStick;
            this.gamepadBinds[GameInput.StowWeapons] = null;
        }
        if (
            version < 5 &&
            this.gamepadBinds[GameInput.EquipOtherGun] == GamepadButton.LeftStick &&
            this.gamepadBinds[GameInput.StowWeapons] === null &&
            !this.gamepadBinds.includes(GamepadButton.Y)
        ) {
            this.gamepadBinds[GameInput.EquipOtherGun] = GamepadButton.Y;
            this.gamepadBinds[GameInput.StowWeapons] = GamepadButton.LeftStick;
        }
        if (
            version < 6 &&
            this.gamepadBinds[GameInput.EquipOtherGun] == GamepadButton.Y &&
            this.gamepadBinds[GameInput.EquipPrevWeap] == GamepadButton.LeftBumper
        ) {
            this.gamepadBinds[GameInput.EquipOtherGun] = GamepadButton.LeftBumper;
            this.gamepadBinds[GameInput.EquipPrevWeap] = null;
        }
    }

    clearAllBinds() {
        for (let i = 0; i < GameInput.Count; i++) {
            this.binds[i] = null;
            this.gamepadBinds[i] = null;
        }
        this.boundKeys = {};
    }

    setBind(bind: number, inputValue: InputValue | null) {
        if (inputValue) {
            for (let i = 0; i < this.binds.length; i++) {
                if (this.binds[i]?.equals(inputValue)) {
                    this.binds[i] = null;
                }
            }
        }
        const curBind = this.binds[bind];

        if (curBind && curBind.type == InputType.Key) {
            this.boundKeys[curBind.code] = null;
        }
        this.binds[bind] = inputValue;
        if (inputValue && inputValue.type == InputType.Key) {
            this.boundKeys[inputValue.code] = true;
        }
    }

    setGamepadBind(bind: number, button: GamepadButton | null) {
        if (button !== null) {
            for (let i = 0; i < this.gamepadBinds.length; i++) {
                if (this.gamepadBinds[i] == button) {
                    this.gamepadBinds[i] = null;
                }
            }
        }
        this.gamepadBinds[bind] = button;
    }

    getGamepadBind(bind: Input) {
        return this.gamepadBinds[bind];
    }

    getBind(bind: number) {
        return this.binds[bind];
    }

    preventMenuBind(b: InputValue | null) {
        return b && this.menuHovered && (b.type == 2 || b.type == 3);
    }

    isKeyBound(key: Key) {
        return this.boundKeys[key];
    }

    isBindPressed(bind: Input) {
        const b = this.binds[bind];
        return (
            (!this.preventMenuBind(b) && !!b && this.input.isInputValuePressed(b)) ||
            this.isGamepadBindPressed(bind)
        );
    }

    isBindReleased(bind: Input) {
        const b = this.binds[bind];
        return (
            (!this.preventMenuBind(b) && !!b && this.input.isInputValueReleased(b)) ||
            this.isGamepadBindReleased(bind)
        );
    }

    isBindDown(bind: Input) {
        const b = this.binds[bind];
        return (
            (!this.preventMenuBind(b) && !!b && this.input.isInputValueDown(b)) ||
            this.isGamepadBindDown(bind)
        );
    }

    isGamepadBindPressed(bind: Input) {
        if (this.input.isGameplayInputBlocked()) {
            return false;
        }
        return this.getGamepadButtonsForAction(bind).some((button) =>
            this.input.gamepadPressed(button),
        );
    }

    isGamepadBindReleased(bind: Input) {
        if (this.input.isGameplayInputBlocked()) {
            return false;
        }
        return this.getGamepadButtonsForAction(bind).some((button) =>
            this.input.gamepadReleased(button),
        );
    }

    isGamepadBindDown(bind: Input) {
        if (this.input.isGameplayInputBlocked()) {
            return false;
        }
        return this.getGamepadButtonsForAction(bind).some((button) =>
            this.input.gamepadDown(button),
        );
    }

    getGamepadButtonsForAction(bind: Input) {
        const buttons: GamepadButton[] = [];
        const button = this.gamepadBinds[bind];
        if (button !== null && button !== undefined) {
            buttons.push(button);
        }
        // The melee trigger both equips the melee weapon and uses it.
        if (bind == GameInput.Fire) {
            const meleeButton = this.gamepadBinds[GameInput.EquipMelee];
            if (
                meleeButton !== null &&
                meleeButton !== undefined &&
                !buttons.includes(meleeButton)
            ) {
                buttons.push(meleeButton);
            }
        }
        return buttons;
    }

    loadDefaultGamepadBinds() {
        for (let i = 0; i < GameInput.Count; i++) {
            this.gamepadBinds[i] = GamepadBindDefaults[i as Input] ?? null;
        }
    }

    loadDefaultBinds() {
        this.clearAllBinds();
        const defKeys = Object.keys(BindDefs);
        for (let i = 0; i < defKeys.length; i++) {
            const key = defKeys[i];
            const def = BindDefs[key as unknown as keyof typeof BindDefs];
            this.setBind(parseInt(key), def.defaultValue);
        }
        this.loadDefaultGamepadBinds();
    }
}

export class InputBindUi {
    constructor(
        public input: InputHandler,
        public inputBinds: InputBinds,
        private localization: Localization,
    ) {
        this.input = input;
        this.inputBinds = inputBinds;
        $(".js-btn-keybind-restore").on("click", () => {
            this.inputBinds.loadDefaultBinds();
            this.inputBinds.saveBinds();
            this.refresh();
        });
        window.addEventListener("controllerconnectionchange", () => {
            this.cancelBind();
            this.refresh();
        });
    }

    cancelBind() {
        this.input.captureNextInput(null);
        this.input.captureNextGamepad(null);
        $(".btn-keybind-desc-selected").removeClass("btn-keybind-desc-selected");
    }

    refresh() {
        const binds = this.inputBinds.binds;
        const container = $(".js-keybind-list");
        const controllerConnected = this.input.gamepadConnected;
        container.empty();
        const header = $("<div/>", {
            class:
                "ui-keybind-container ui-keybind-header" +
                (controllerConnected ? " controller-enabled" : ""),
        })
            .append($("<div/>", { text: "Action" }))
            .append($("<div/>", { text: "Keyboard / Mouse" }));
        if (controllerConnected) {
            header.append($("<div/>", { text: "Controller" }));
        }
        container.append(header);
        const appendFixedRow = (action: string, keyboard: string, controller: string) => {
            container.append(
                $("<div/>", {
                    class: "ui-keybind-container controller-enabled",
                })
                    .append($("<div/>", { class: "btn-keybind-desc", text: action }))
                    .append(
                        $("<div/>", {
                            class: "btn-game-menu btn-keybind-display btn-disabled",
                            text: keyboard,
                        }),
                    )
                    .append(
                        $("<div/>", {
                            class: "btn-game-menu btn-keybind-display btn-disabled",
                            text: controller,
                        }),
                    ),
            );
        };
        if (controllerConnected) {
            appendFixedRow("Aim", "Mouse", "Right Stick");
            appendFixedRow("Pause Menu", "ESC", "Menu / Options");
        }
        for (let i = 0; i < BindDisplayOrder.length; i++) {
            const bindIdx = BindDisplayOrder[i] as Input;
            const bindDef = BindDefs[bindIdx as keyof typeof BindDefs];
            const bind = binds[bindIdx];
            const gamepadBind = this.inputBinds.getGamepadBind(bindIdx);
            const fixedGamepadLabel = FixedGamepadLabels[bindIdx];
            const nameKey =
                "bind-" +
                bindDef.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/g, "");
            const label = $("<div/>", {
                class: "btn-keybind-desc",
                text: this.localization.translate(nameKey) || bindDef.name,
            });
            const keyboardBtn = $("<a/>", {
                class: "btn-game-menu btn-darken btn-keybind-display",
                "data-bind": bindIdx,
                "data-device": "keyboard",
                text: bind
                    ? this.localization.translate(bind.toString()) || bind.toString()
                    : "Unbound",
            });
            const gamepadBtn = $(fixedGamepadLabel ? "<div/>" : "<a/>", {
                class:
                    "btn-game-menu btn-darken btn-keybind-display" +
                    (fixedGamepadLabel ? " btn-disabled" : ""),
                "data-bind": bindIdx,
                "data-device": "controller",
                text: fixedGamepadLabel
                    ? fixedGamepadLabel
                    : gamepadBind === null || gamepadBind === undefined
                      ? "Unbound"
                      : getGamepadButtonName(gamepadBind),
            });
            keyboardBtn.on("click", () => this.beginKeyboardBind(bindIdx));
            if (!fixedGamepadLabel) {
                gamepadBtn.on("click", () => this.beginGamepadBind(bindIdx));
            }
            const row = $("<div/>", {
                class:
                    "ui-keybind-container" +
                    (controllerConnected ? " controller-enabled" : ""),
            })
                .append(label)
                .append(keyboardBtn);
            if (controllerConnected) {
                row.append(gamepadBtn);
            }
            container.append(row);
        }
        $("#keybind-link").html(this.inputBinds.toBase64());
    }

    beginKeyboardBind(bindIdx: Input) {
        this.cancelBind();
        const selector = `.btn-keybind-display[data-bind="${bindIdx}"][data-device="keyboard"]`;
        $(selector).addClass("btn-keybind-desc-selected");
        this.input.captureNextInput((event, inputValue) => {
            event.preventDefault();
            event.stopPropagation();
            const disallowKeys: number[] = [
                Key.Control,
                Key.Alt,
                Key.Windows,
                Key.ContextMenu,
                Key.F1,
                Key.F2,
                Key.F3,
                Key.F4,
                Key.F5,
                Key.F6,
                Key.F7,
                Key.F8,
                Key.F9,
                Key.F10,
                Key.F11,
                Key.F12,
            ];
            if (
                inputValue.type == InputType.Key &&
                disallowKeys.includes(inputValue.code)
            ) {
                return false;
            }
            $(selector).removeClass("btn-keybind-desc-selected");
            if (!inputValue.equals(inputKey(Key.Escape))) {
                const bindValue = inputValue.equals(inputKey(Key.Backspace))
                    ? null
                    : inputValue;
                this.inputBinds.setBind(bindIdx, bindValue);
                this.inputBinds.saveBinds();
                this.refresh();
            }
            return true;
        });
    }

    beginGamepadBind(bindIdx: Input) {
        this.cancelBind();
        const selector = `.btn-keybind-display[data-bind="${bindIdx}"][data-device="controller"]`;
        $(selector).addClass("btn-keybind-desc-selected");
        this.input.captureNextInput((event, inputValue) => {
            if (
                !inputValue.equals(inputKey(Key.Escape)) &&
                !inputValue.equals(inputKey(Key.Backspace))
            ) {
                return false;
            }
            event.preventDefault();
            event.stopPropagation();
            $(selector).removeClass("btn-keybind-desc-selected");
            if (inputValue.equals(inputKey(Key.Backspace))) {
                this.inputBinds.setGamepadBind(bindIdx, null);
                this.inputBinds.saveBinds();
                this.refresh();
            }
            this.input.captureNextGamepad(null);
            return true;
        });
        this.input.captureNextGamepad((button) => {
            if (button == GamepadButton.Start || button == GamepadButton.Home) {
                this.beginGamepadBind(bindIdx);
                return;
            }
            $(selector).removeClass("btn-keybind-desc-selected");
            this.input.captureNextInput(null);
            this.inputBinds.setGamepadBind(bindIdx, button);
            this.inputBinds.saveBinds();
            this.refresh();
        });
    }
}
