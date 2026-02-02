import $ from "jquery";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import type { EmoteDef } from "../../../shared/defs/gameObjects/emoteDefs";
import { UnlockDefs } from "../../../shared/defs/gameObjects/unlockDefs";
import {
    ClanConstants,
    type ClanDetail,
    type ClanInfo,
    type ClanLeaderboardEntry,
    type CreateClanResponse,
    type GetMyClanResponse,
    type JoinClanResponse,
    type ListClansResponse,
    type ClanLeaderboardResponse,
    type UpdateClanResponse,
} from "../../../shared/types/clan";
import type { Account } from "../account";
import { api } from "../api";
import type { Localization } from "./localization";
import { MenuModal } from "./menuModal";

function clanRequest<T>(
    url: string,
    data: Record<string, unknown> | null,
    callback: (err: any, res?: T) => void,
) {
    const opts: JQueryAjaxSettings = {
        url: api.resolveUrl(url),
        type: data ? "POST" : "GET",
        timeout: 10 * 1000,
        xhrFields: {
            withCredentials: true,
        },
        headers: {
            "X-Requested-With": "XMLHttpRequest",
        },
    };
    if (data) {
        opts.contentType = "application/json; charset=utf-8";
        opts.data = JSON.stringify(data);
    }
    $.ajax(opts)
        .done((res) => callback(null, res))
        .fail((err) => callback(err));
}

function getClanIconUrl(iconType: string): string {
    const def = GameObjectDefs[iconType] as EmoteDef | undefined;
    if (def && def.type === "emote" && def.texture) {
        return `img/emotes/${def.texture.slice(0, -4)}.svg`;
    }
    return "img/gui/player-gui.svg";
}

function formatTimeRemaining(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

export class ClanUi {
    mainModal: MenuModal;
    iconModal: MenuModal;
    clanPageModal: MenuModal;
    leaderboardModal: MenuModal;
    
    currentClan: ClanDetail | null = null;
    viewingClan: ClanDetail | null = null;
    cooldownUntil: number | null = null;
    availableIcons: string[] = [];
    selectedIcon: string = "emote_surviv";
    isEditingIcon: boolean = false;
    
    constructor(
        public account: Account,
        public localization: Localization,
    ) {
        this.mainModal = new MenuModal($("#modal-clan-main"));
        this.iconModal = new MenuModal($("#modal-clan-icons"));
        this.clanPageModal = new MenuModal($("#modal-clan-page"));
        this.leaderboardModal = new MenuModal($("#modal-clan-leaderboard"));
        
        this.initUi();
        this.loadAvailableIcons();
    }
    
    initUi() {
        $("#btn-clan-create-submit").on("click", () => {
            this.createClan();
        });
        
        $("#clan-create-name-input").on("keypress", (e) => {
            if (e.key === "Enter") {
                this.createClan();
            }
        });
        $("#btn-clan-icon-edit").on("click", () => {
            this.isEditingIcon = false;
            this.showIconSelector();
        });
        $("#btn-clan-icon-reset").on("click", () => {
            this.selectIcon("emote_surviv");
        });
        $(".btn-clan-icons-close").on("click", () => {
            this.iconModal.hide();
        });
        $("#btn-clan-icon-confirm").on("click", () => {
            if (this.isEditingIcon && this.viewingClan) {
                this.updateClan({ icon: this.selectedIcon });
            }
            this.iconModal.hide();
        });
        $("#clan-icon-selector").on("click", ".clan-icon-option", (e) => {
            const icon = $(e.currentTarget).data("icon") as string;
            this.selectIcon(icon);
        });
        $("#btn-clan-edit-icon").on("click", () => {
            if (this.viewingClan) {
                this.isEditingIcon = true;
                this.selectedIcon = this.viewingClan.icon;
                this.showIconSelector();
            }
        });
        $("#btn-clan-edit-name").on("click", () => {
            if (this.viewingClan) {
                $("#clan-detail-name").hide();
                $("#btn-clan-edit-name").hide();
                $("#clan-detail-name-edit").show();
                $("#clan-edit-name-input").val(this.viewingClan.name).focus();
            }
        });
        $("#btn-clan-save-name").on("click", () => {
            const newName = ($("#clan-edit-name-input").val() as string).trim();
            if (newName && this.viewingClan && newName !== this.viewingClan.name) {
                this.updateClan({ name: newName });
            } else {
                this.cancelNameEdit();
            }
        });
        $("#btn-clan-cancel-name").on("click", () => {
            this.cancelNameEdit();
        });
        $("#clan-edit-name-input").on("keypress", (e) => {
            if (e.key === "Enter") {
                $("#btn-clan-save-name").trigger("click");
            }
        });
        $("#btn-clan-leave").on("click", () => {
            if (confirm("Are you sure you want to leave this clan?")) {
                this.leaveClan();
            }
        });
        $("#btn-clan-delete").on("click", () => {
            if (confirm("Are you sure you want to delete this clan? This action cannot be undone.")) {
                this.deleteClan();
            }
        });
        $("#btn-clan-my-clan").on("click", () => {
            if (this.currentClan) {
                this.mainModal.hide();
                this.showClanPage(this.currentClan.id);
            }
        });
        $("#btn-clan-view-details").on("click", () => {
            if (this.currentClan) {
                this.mainModal.hide();
                this.showClanPage(this.currentClan.id);
            }
        });
        $("#btn-clan-leave-main").on("click", () => {
            if (confirm("Are you sure you want to leave this clan?")) {
                this.leaveClan();
            }
        });
        $("#btn-clan-delete-main").on("click", () => {
            if (confirm("Are you sure you want to delete this clan? This action cannot be undone.")) {
                this.deleteClan();
            }
        });
        $("#btn-clan-leaderboard").on("click", () => {
            this.mainModal.hide();
            this.showLeaderboard();
        });
        $("#btn-clan-back-to-hub, #btn-leaderboard-back").on("click", () => {
            this.clanPageModal.hide();
            this.leaderboardModal.hide();
            this.showMainModal();
        });
        $("#btn-clan-search").on("click", () => {
            this.loadClanList(1);
        });
        
        $("#clan-search-input").on("keypress", (e) => {
            if (e.key === "Enter") {
                this.loadClanList(1);
            }
        });
        $(".clan-leaderboard-tab").on("click", (e) => {
            const type = $(e.currentTarget).data("type") as "kills" | "wins";
            $(".clan-leaderboard-tab").removeClass("active");
            $(e.currentTarget).addClass("active");
            this.loadLeaderboard(type);
        });
        $(".modal-clans-close.close").on("click", (e) => {
            const modal = $(e.currentTarget).closest(".modal");
            if (modal.attr("id") === "modal-clan-main") {
                this.mainModal.hide();
            } else if (modal.attr("id") === "modal-clan-page") {
                this.clanPageModal.hide();
            } else if (modal.attr("id") === "modal-clan-leaderboard") {
                this.leaderboardModal.hide();
            }
        });
    }
    
    loadAvailableIcons() {
        const items = this.account.items || [];
        const defaultUnlocks = UnlockDefs.unlock_default.unlocks;
        this.availableIcons = [];
        for (const type of defaultUnlocks) {
            const def = GameObjectDefs[type] as EmoteDef | undefined;
            if (def && def.type === "emote") {
                this.availableIcons.push(type);
            }
        }
        for (const item of items) {
            const def = GameObjectDefs[item.type] as EmoteDef | undefined;
            if (def && def.type === "emote" && !this.availableIcons.includes(item.type)) {
                this.availableIcons.push(item.type);
            }
        }
    }
    
    selectIcon(icon: string) {
        this.selectedIcon = icon;
        $(".clan-icon-option").removeClass("selected");
        $(`.clan-icon-option[data-icon="${icon}"]`).addClass("selected");
        $("#clan-create-icon-preview").css("background-image", `url(${getClanIconUrl(icon)})`);
    }
    
    showMainModal() {
        this.loadMyClan();
        this.loadAvailableIcons();
        this.resetDefaults();
        this.loadClanList(1);
        this.mainModal.show(true);
    }
    
    showIconSelector() {
        const iconContainer = $("#clan-icon-selector");
        iconContainer.empty();
        for (const icon of this.availableIcons) {
            const iconUrl = getClanIconUrl(icon);
            const div = $("<div/>", {
                class: "clan-icon-option" + (icon === this.selectedIcon ? " selected" : ""),
                "data-icon": icon,
            }).css("background-image", `url(${iconUrl})`);
            iconContainer.append(div);
        }
        this.iconModal.show(true);
    }
    
    resetDefaults() {
        this.selectedIcon = "emote_surviv";
        $("#clan-create-name-input").val("");
        $("#clan-create-icon-preview").css("background-image", `url(${getClanIconUrl(this.selectedIcon)})`);
        $("#clan-create-warning").hide();
    }
    
    showClanPage(clanId: string) {
        this.loadClanDetail(clanId);
        this.mainModal.hide();
        this.clanPageModal.show(true);
    }
    
    showLeaderboard() {
        $(".clan-leaderboard-tab").removeClass("active").first().addClass("active");
        this.loadLeaderboard("kills");
        this.leaderboardModal.show(true);
    }
    
    showError(message: string) {
        alert(message);
    }
    
    loadMyClan() {
        clanRequest<GetMyClanResponse>("/api/clan/my_clan", {}, (err, res) => {
            if (err || !res?.success) {
                console.error("Failed to load clan data");
                return;
            }
            
            this.currentClan = res.clan;
            this.cooldownUntil = res.cooldownUntil;
            
            this.updateMainCard();
        });
    }
    
    updateMainCard() {
        if (this.currentClan) {
            $("#clan-create-card").hide();
            $("#clan-my-card").show();
            $("#btn-clan-create-submit").hide();
            $("#btn-clan-my-clan").removeClass("disabled").css("opacity", "1");
            $("#clan-my-icon").css("background-image", `url(${getClanIconUrl(this.currentClan.icon)})`);
            $("#clan-my-name").text(this.currentClan.name);
            $("#clan-my-members").text(`${this.currentClan.memberCount} / ${this.currentClan.maxMembers} Members`);
            $("#clan-my-kills").text(this.currentClan.totalKills.toLocaleString());
            $("#clan-my-wins").text(this.currentClan.totalWins.toLocaleString());
            const isOwner = this.currentClan.members?.some(
                m => m.slug === this.account.profile?.slug && m.isOwner
            );
            
            if (isOwner) {
                $("#btn-clan-leave-main").hide();
                $("#btn-clan-delete-main").show();
            } else {
                $("#btn-clan-leave-main").show();
                $("#btn-clan-delete-main").hide();
            }
        } else {
            $("#clan-create-card").show();
            $("#clan-my-card").hide();
            $("#btn-clan-create-submit").show();
            $("#btn-clan-my-clan").addClass("disabled").css("opacity", "0.5");
        }
        if (this.cooldownUntil && this.cooldownUntil > Date.now()) {
            const remaining = formatTimeRemaining(this.cooldownUntil - Date.now());
            $("#clan-create-warning").text(`You can join a clan in ${remaining}`).show();
        }
    }
    
    createClan() {
        const name = ($("#clan-create-name-input").val() as string).trim();
        
        if (this.currentClan) {
            $("#clan-create-warning").text("You must leave your current clan first.").show();
            return;
        }
        
        if (this.cooldownUntil && this.cooldownUntil > Date.now()) {
            $("#clan-create-warning").text(`You must wait ${formatTimeRemaining(this.cooldownUntil - Date.now())} before creating a clan.`).show();
            return;
        }
        
        if (name.length < ClanConstants.NameMinLen) {
            $("#clan-create-warning").text(`Clan name must be at least ${ClanConstants.NameMinLen} characters.`).show();
            return;
        }
        
        if (name.length > ClanConstants.NameMaxLen) {
            $("#clan-create-warning").text(`Clan name must be at most ${ClanConstants.NameMaxLen} characters.`).show();
            return;
        }
        
        clanRequest<CreateClanResponse>("/api/clan/create", {
            name,
            icon: this.selectedIcon,
        }, (err, res) => {
            if (err) {
                $("#clan-create-warning").text("Server error. Please try again.").show();
                return;
            }
            
            if (!res?.success) {
                const errorMessages: Record<string, string> = {
                    name_taken: "This clan name is already taken.",
                    invalid_name: "Invalid clan name.",
                    already_in_clan: "You are already in a clan.",
                    server_error: "Server error. Please try again.",
                };
                $("#clan-create-warning").text(errorMessages[res?.error || "server_error"]).show();
                return;
            }
            
            this.mainModal.hide();
            this.loadMyClan();
            if (res.clan) {
                this.showClanPage(res.clan.id);
            }
        });
    }
    
    loadClanList(page: number) {
        const search = ($("#clan-search-input").val() as string || "").trim();
        
        clanRequest<ListClansResponse>("/api/clan/list", {
            page,
            limit: 20,
            search: search || undefined,
        }, (err, res) => {
            if (err || !res) {
                console.error("Failed to load clan list");
                return;
            }
            
            this.renderClanList(res.clans, res.page, res.totalPages);
        });
    }
    
    renderClanList(clans: ClanInfo[], page: number, totalPages: number) {
        const container = $("#clan-list-container");
        container.empty();
        
        if (clans.length === 0) {
            container.append($("<div/>", {
                class: "clan-list-empty",
                text: "No clans found.",
            }));
            return;
        }
        
        for (const clan of clans) {
            const isFull = clan.memberCount >= clan.maxMembers;
            const item = $("<div/>", {
                class: "clan-list-item",
            });
            
            item.append($("<div/>", {
                class: "clan-list-icon",
            }).css("background-image", `url(${getClanIconUrl(clan.icon)})`));
            
            item.append($("<div/>", {
                class: "clan-list-info",
            }).append(
                $("<div/>", { class: "clan-list-name", text: clan.name }),
                $("<div/>", { class: "clan-list-members", text: `${clan.memberCount}/${clan.maxMembers} members` }),
            ));
            
            if (isFull) {
                item.append($("<div/>", {
                    class: "clan-list-status",
                    text: "FULL",
                }));
            } else if (!this.currentClan) {
                const joinBtn = $("<div/>", {
                    class: "clan-btn clan-btn-teal clan-btn-small",
                    text: "Join",
                }).on("click", (e) => {
                    e.stopPropagation();
                    this.joinClan(clan.id);
                });
                item.append(joinBtn);
            }
            
            item.on("click", () => {
                this.showClanPage(clan.id);
            });
            
            container.append(item);
        }
        
        if (totalPages > 1) {
            const pagination = $("<div/>", { class: "clan-pagination" });
            if (page > 1) {
                pagination.append($("<div/>", {
                    class: "clan-btn clan-btn-grey clan-btn-small",
                    text: "Previous",
                }).on("click", () => this.loadClanList(page - 1)));
            }
            pagination.append($("<span/>", { 
                class: "clan-pagination-info",
                text: `Page ${page} of ${totalPages}`,
            }));
            if (page < totalPages) {
                pagination.append($("<div/>", {
                    class: "clan-btn clan-btn-grey clan-btn-small",
                    text: "Next",
                }).on("click", () => this.loadClanList(page + 1)));
            }
            container.append(pagination);
        }
    }
    
    joinClan(clanId: string) {
        if (this.currentClan) {
            this.showError("You must leave your current clan first.");
            return;
        }
        
        if (this.cooldownUntil && this.cooldownUntil > Date.now()) {
            this.showError(`You must wait ${formatTimeRemaining(this.cooldownUntil - Date.now())} before joining a clan.`);
            return;
        }
        
        clanRequest<JoinClanResponse>("/api/clan/join", { clanId }, (err, res) => {
            if (err) {
                this.showError("Server error. Please try again.");
                return;
            }
            
            if (!res?.success) {
                const errorMessages: Record<string, string> = {
                    clan_not_found: "Clan not found.",
                    clan_full: "This clan is full.",
                    already_in_clan: "You are already in a clan.",
                    cooldown_active: "You must wait before joining a new clan.",
                    server_error: "Server error. Please try again.",
                };
                this.showError(errorMessages[res?.error || "server_error"]);
                return;
            }
            
            this.mainModal.hide();
            this.clanPageModal.hide();
            this.loadMyClan();
            this.showClanPage(clanId);
        });
    }
    
    loadClanDetail(clanId: string) {
        clanRequest<{ success: boolean; clan?: ClanDetail }>("/api/clan/get", { clanId }, (err, res) => {
            if (err || !res?.success || !res.clan) {
                this.showError("Failed to load clan details.");
                return;
            }
            
            this.viewingClan = res.clan;
            this.renderClanDetail(res.clan);
        });
    }
    
    renderClanDetail(clan: ClanDetail) {
        $("#clan-detail-icon").css("background-image", `url(${getClanIconUrl(clan.icon)})`);
        $("#clan-detail-name").text(clan.name);
        $("#clan-detail-members-count, #clan-members-count").text(`${clan.memberCount} / ${clan.maxMembers}`);
        $("#clan-detail-kills").text(clan.totalKills.toLocaleString());
        $("#clan-detail-wins").text(clan.totalWins.toLocaleString());
        $("#clan-detail-games").text("0");
        const membersContainer = $("#clan-members-list");
        membersContainer.empty();
        
        const isOwner = this.account.profile?.slug && clan.members.some(
            m => m.slug === this.account.profile.slug && m.isOwner
        );
        const isMember = this.account.profile?.slug && clan.members.some(
            m => m.slug === this.account.profile.slug
        );
        if (isOwner) {
            $("#btn-clan-edit-icon").show();
            $("#btn-clan-edit-name").show();
        } else {
            $("#btn-clan-edit-icon").hide();
            $("#btn-clan-edit-name").hide();
        }
        this.cancelNameEdit();
        
        for (const member of clan.members) {
            const item = $("<div/>", { class: "clan-member-item" });
            
            const iconDiv = $("<div/>", {
                class: "clan-member-icon",
            }).css("background-image", `url(${getClanIconUrl(member.playerIcon)})`);
            
            if (member.isOwner) {
                iconDiv.append($("<div/>", { class: "clan-member-crown" }));
            }
            
            item.append(iconDiv);
            
            item.append($("<div/>", {
                class: "clan-member-info",
            }).append(
                $("<div/>", { 
                    class: "clan-member-name" + (member.isOwner ? " owner" : ""), 
                    text: member.username,
                }),
                $("<div/>", { 
                    class: "clan-member-stats", 
                    text: `Kills: ${member.statsAfterJoin.kills} | Wins: ${member.statsAfterJoin.wins}`,
                }),
            ));
            if (isOwner && !member.isOwner) {
                const controls = $("<div/>", { class: "clan-member-controls" });
                
                controls.append($("<div/>", {
                    class: "clan-btn-small clan-btn-transfer",
                    text: "Transfer",
                    title: "Transfer ownership",
                }).on("click", (e) => {
                    e.stopPropagation();
                    if (confirm(`Transfer ownership to ${member.username}?`)) {
                        this.transferOwnership(member.odUserId);
                    }
                }));
                
                controls.append($("<div/>", {
                    class: "clan-btn-small clan-btn-kick",
                    text: "Kick",
                }).on("click", (e) => {
                    e.stopPropagation();
                    if (confirm(`Kick ${member.username} from the clan?`)) {
                        this.kickMember(member.odUserId);
                    }
                }));
                
                item.append(controls);
            }
            
            membersContainer.append(item);
        }
        if (isMember) {
            $("#clan-member-actions").show();
            if (isOwner) {
                $("#btn-clan-leave").hide();
                $("#btn-clan-delete").show();
            } else {
                $("#btn-clan-leave").show();
                $("#btn-clan-delete").hide();
            }
        } else {
            $("#clan-member-actions").hide();
        }
    }
    
    leaveClan() {
        clanRequest<{ success: boolean }>("/api/clan/leave", {}, (err, res) => {
            if (err || !res?.success) {
                this.showError("Failed to leave clan.");
                return;
            }
            
            this.clanPageModal.hide();
            this.currentClan = null;
            this.loadMyClan();
            this.showMainModal();
        });
    }
    
    kickMember(memberId: string) {
        clanRequest<{ success: boolean }>("/api/clan/kick", { memberId }, (err, res) => {
            if (err || !res?.success) {
                this.showError("Failed to kick member.");
                return;
            }
            if (this.currentClan) {
                this.loadClanDetail(this.currentClan.id);
            }
        });
    }
    
    transferOwnership(newOwnerId: string) {
        clanRequest<{ success: boolean }>("/api/clan/transfer", { newOwnerId }, (err, res) => {
            if (err || !res?.success) {
                this.showError("Failed to transfer ownership.");
                return;
            }
            if (this.currentClan) {
                this.loadClanDetail(this.currentClan.id);
                this.loadMyClan();
            }
        });
    }
    
    deleteClan() {
        clanRequest<{ success: boolean }>("/api/clan/delete", {}, (err, res) => {
            if (err || !res?.success) {
                this.showError("Failed to delete clan.");
                return;
            }
            
            this.clanPageModal.hide();
            this.currentClan = null;
            this.loadMyClan();
            this.showMainModal();
        });
    }
    
    loadLeaderboard(type: "kills" | "wins", page: number = 1) {
        clanRequest<ClanLeaderboardResponse>("/api/clan/leaderboard", {
            type,
            page,
            limit: 50,
        }, (err, res) => {
            if (err || !res) {
                console.error("Failed to load leaderboard");
                return;
            }
            
            this.renderLeaderboard(res.entries, type, res.page, res.totalPages);
        });
    }
    
    renderLeaderboard(entries: ClanLeaderboardEntry[], type: "kills" | "wins", page: number, totalPages: number) {
        const container = $("#clan-leaderboard-list");
        container.empty();
        
        if (entries.length === 0) {
            container.append($("<div/>", {
                class: "clan-leaderboard-empty",
                text: "No clans found.",
            }));
            return;
        }
        
        for (const entry of entries) {
            const rankClass = entry.rank <= 3 ? ` rank-${entry.rank}` : "";
            const item = $("<div/>", { class: `clan-leaderboard-item${rankClass}` });
            
            item.append($("<div/>", {
                class: "clan-leaderboard-rank",
                text: `${entry.rank}`,
            }));
            
            item.append($("<div/>", {
                class: "clan-leaderboard-icon",
            }).css("background-image", `url(${getClanIconUrl(entry.clan.icon)})`));
            
            item.append($("<div/>", {
                class: "clan-leaderboard-info",
            }).append(
                $("<div/>", { class: "clan-leaderboard-name", text: entry.clan.name }),
                $("<div/>", { 
                    class: "clan-leaderboard-members", 
                    text: `${entry.clan.memberCount} members`,
                }),
            ));
            
            item.append($("<div/>", {
                class: "clan-leaderboard-stat",
                text: type === "kills" ? entry.clan.totalKills.toLocaleString() : entry.clan.totalWins.toLocaleString(),
            }));
            
            item.on("click", () => {
                this.leaderboardModal.hide();
                this.showClanPage(entry.clan.id);
            });
            
            container.append(item);
        }
        
        if (totalPages > 1) {
            const pagination = $("<div/>", { class: "clan-pagination" });
            if (page > 1) {
                pagination.append($("<div/>", {
                    class: "clan-btn clan-btn-grey clan-btn-small",
                    text: "Previous",
                }).on("click", () => this.loadLeaderboard(type, page - 1)));
            }
            pagination.append($("<span/>", { 
                class: "clan-pagination-info",
                text: `Page ${page} of ${totalPages}`,
            }));
            if (page < totalPages) {
                pagination.append($("<div/>", {
                    class: "clan-btn clan-btn-grey clan-btn-small",
                    text: "Next",
                }).on("click", () => this.loadLeaderboard(type, page + 1)));
            }
            container.append(pagination);
        }
    }
    
    cancelNameEdit() {
        $("#clan-detail-name-edit").hide();
        $("#clan-detail-name").show();
        $("#btn-clan-edit-name").show();
    }
    
    updateClan(updates: { name?: string; icon?: string }) {
        clanRequest<UpdateClanResponse>("/api/clan/update", updates, (err, res) => {
            if (err) {
                this.showError("Server error. Please try again.");
                return;
            }
            
            if (!res?.success) {
                const errorMessages: Record<string, string> = {
                    not_owner: "You are not the owner of this clan.",
                    name_taken: "This clan name is already taken.",
                    invalid_name: "Invalid clan name.",
                    server_error: "Server error. Please try again.",
                };
                this.showError(errorMessages[res?.error || "server_error"]);
                return;
            }
            this.currentClan = res.clan;
            this.viewingClan = res.clan;
            this.renderClanDetail(res.clan);
            this.cancelNameEdit();
            this.updateMainCard();
        });
    }
}
