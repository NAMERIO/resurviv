import $ from "jquery";
import type {
    ManageNewsPost,
    ManageNewsResponse,
    NewsDocument,
    NewsPost,
    SaveNewsRequest,
} from "../../shared/types/news";
import type { Account } from "./account";
import { api } from "./api";

type NewsRun = NewsDocument["paragraphs"][number]["runs"][number];

function safeLinkUrl(value: string | undefined) {
    if (!value) return undefined;
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
    } catch {
        return undefined;
    }
}

function normalizeColor(value: string | undefined) {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        return `#${[...trimmed.slice(1)].map((part) => part.repeat(2)).join("")}`.toLowerCase();
    }
    const match = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return undefined;
    return `#${match
        .slice(1, 4)
        .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0"))
        .join("")}`;
}

function textDocument(content: string): NewsDocument {
    const paragraphs = content.split(/\r?\n/).map((text) => ({
        runs: text ? [{ text }] : [],
    }));
    return { paragraphs: paragraphs.length ? paragraphs : [{ runs: [] }] };
}

function getPostDocument(post: Pick<NewsPost, "content" | "document">) {
    return post.document?.paragraphs?.length ? post.document : textDocument(post.content);
}

export function appendNewsDocument(postElement: JQuery, post: NewsPost) {
    for (const paragraph of getPostDocument(post).paragraphs) {
        const paragraphElement = $("<p>").addClass("news-paragraph");
        if (!paragraph.runs.length) paragraphElement.append($("<br>"));

        for (const run of paragraph.runs) {
            if (typeof run.text !== "string") continue;
            const linkUrl = safeLinkUrl(run.linkUrl);
            const runElement = linkUrl
                ? $("<a>").attr({
                      href: linkUrl,
                      target: "_blank",
                      rel: "noopener noreferrer",
                  })
                : $("<span>");
            const color = normalizeColor(run.color);
            if (color) runElement.css("color", color);
            runElement.text(run.text);
            paragraphElement.append(runElement);
        }
        postElement.append(paragraphElement);
    }
}

export class NewsManager {
    private posts: ManageNewsPost[] = [];
    private selectedId?: number;
    private savedRange?: Range;

    constructor(
        private readonly account: Account,
        private readonly onNewsChanged: () => void,
    ) {}

    init() {
        $("#news-manage-button").on("click", () => void this.open());
        $("#news-editor-back").on("click", () => this.close());
        $("#news-editor-list").on("click", () => this.showList());
        $("#news-editor-new").on("click", () => this.startNewPost());
        $("#news-editor-save-draft").on("click", () => void this.save(false));
        $("#news-editor-publish").on("click", () => void this.save(true));
        $("#news-editor-delete").on("click", () => void this.deletePost());
        $("#news-editor-color-menu").on("mousedown", (event) => {
            event.preventDefault();
            this.openColorPalette();
        });
        $("#news-editor-color-apply").on("mousedown", (event) => {
            event.preventDefault();
            this.applyColor();
        });
        $(".news-color-swatch").on("mousedown", (event) => {
            event.preventDefault();
            this.applyColor(String($(event.currentTarget).data("news-color")));
        });
        $("#news-editor-link").on("mousedown", (event) => {
            event.preventDefault();
            this.openLinkEditor();
        });
        $("#news-link-apply").on("click", () => this.applyLink());
        $("#news-link-cancel").on("click", () => this.closeLinkEditor());
        $("#news-editor-content")
            .on("keyup mouseup", () => this.captureSelection(true))
            .on("input", () => this.captureSelection(false))
            .on("scroll", () => this.hideSelectionTools())
            .on("paste", (event) => {
                event.preventDefault();
                const clipboardEvent = event.originalEvent as ClipboardEvent | undefined;
                const text = clipboardEvent?.clipboardData?.getData("text/plain") ?? "";
                document.execCommand("insertText", false, text);
            })
            .on("click", "a", (event) => event.preventDefault());
        $("#news-editor-title, #news-editor-date").on("focus", () =>
            this.hideSelectionTools(),
        );
        this.updateAccess();
    }

    updateAccess() {
        const canManage = this.account.loggedIn && this.account.profile.canManageNews;
        $("#news-manage-button").toggle(Boolean(canManage));
        if (!canManage) this.close();
    }

    private async open() {
        if (!this.account.profile.canManageNews) return;
        $("#news-block").hide();
        $("#news-manager").show();
        $("#news-manage-button").hide();
        $("#modal-news-card").addClass("news-managing");
        $("#modal-news-title").text("Manage News");
        this.showList();
        await this.loadPosts();
    }

    private close() {
        $("#news-manager").hide();
        $("#news-block").show();
        $("#modal-news-card").removeClass("news-managing");
        $("#modal-news-title").text("What's New!");
        $("#news-manage-button").toggle(
            Boolean(this.account.loggedIn && this.account.profile.canManageNews),
        );
        this.hideSelectionTools();
    }

    private async request<T>(path: string, body?: object): Promise<T> {
        const response = await fetch(api.resolveUrl(`/api/news${path}`), {
            method: body ? "POST" : "GET",
            cache: "no-store",
            credentials: "include",
            headers: body
                ? {
                      "Content-Type": "application/json",
                      "X-Requested-With": "XMLHttpRequest",
                  }
                : { Accept: "application/json" },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = (await response.json().catch(() => ({}))) as T & { error?: string };
        if (!response.ok) throw new Error(data.error || "Request failed");
        return data;
    }

    private showList() {
        $("#news-editor-view").hide();
        $("#news-manager-list-view").show();
        this.hideSelectionTools();
    }

    private showEditor() {
        $("#news-manager-list-view").hide();
        $("#news-editor-view").css("display", "flex");
    }

    private renderPostList() {
        const list = $("#news-post-list").empty();
        if (!this.posts.length) {
            list.append(
                $("<div>")
                    .addClass("news-post-list-message")
                    .text("No saved posts yet. Create your first news post."),
            );
            return;
        }

        for (const post of this.posts) {
            const status = post.isPublished ? "Published" : "Draft";
            const card = $("<button>")
                .attr("type", "button")
                .addClass(`news-post-card ${post.isPublished ? "published" : "draft"}`)
                .on("click", () => this.loadPost(post.id));
            card.append(
                $("<div>")
                    .addClass("news-post-card-copy")
                    .append(
                        $("<strong>").text(post.title),
                        $("<span>").text(post.dateText || "No displayed date"),
                    ),
                $("<span>").addClass("news-post-status").text(status),
                $("<span>").addClass("news-post-open").text("Edit ›"),
            );
            list.append(card);
        }
    }

    private async loadPosts(selectId?: number) {
        $("#news-post-list")
            .empty()
            .append($("<div>").addClass("news-post-list-message").text("Loading…"));
        try {
            const data = await this.request<ManageNewsResponse>("/manage");
            this.posts = data.posts;
            this.renderPostList();

            const nextId = selectId ?? this.selectedId;
            if (nextId && this.posts.some((post) => post.id === nextId)) {
                this.loadPost(nextId);
            } else {
                this.selectedId = undefined;
                this.showList();
            }
        } catch (error) {
            $("#news-post-list")
                .empty()
                .append(
                    $("<div>")
                        .addClass("news-post-list-message error")
                        .text(
                            error instanceof Error
                                ? error.message
                                : "Could not load news",
                        ),
                );
            this.showList();
        }
    }

    private startNewPost() {
        this.selectedId = undefined;
        this.showEditor();
        $("#news-editor-mode").text("New Post");
        $("#news-editor-title").val("");
        $("#news-editor-date").val(
            new Date().toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
        );
        this.setEditorDocument({ paragraphs: [{ runs: [] }] });
        $("#news-editor-delete").hide();
        this.setStatus("Not saved yet");
        $("#news-editor-title").trigger("focus");
    }

    private loadPost(id: number) {
        const post = this.posts.find((entry) => entry.id === id);
        if (!post) return;
        this.selectedId = id;
        this.showEditor();
        $("#news-editor-mode").text(
            post.isPublished ? "Edit Published Post" : "Edit Draft",
        );
        $("#news-editor-title").val(post.title);
        $("#news-editor-date").val(post.dateText || "");
        this.setEditorDocument(getPostDocument(post));
        $("#news-editor-delete").show();
        this.setStatus(post.isPublished ? `Published post #${id}` : `Saved draft #${id}`);
    }

    private setEditorDocument(newsDocument: NewsDocument) {
        const editor = $("#news-editor-content").empty();
        for (const paragraph of newsDocument.paragraphs) {
            const line = $("<div>");
            if (!paragraph.runs.length) line.append($("<br>"));
            for (const run of paragraph.runs) {
                const linkUrl = safeLinkUrl(run.linkUrl);
                const element = linkUrl
                    ? $("<a>").attr({
                          href: linkUrl,
                          target: "_blank",
                          rel: "noopener noreferrer",
                      })
                    : $("<span>");
                const color = normalizeColor(run.color);
                if (color) element.css("color", color);
                element.text(run.text);
                line.append(element);
            }
            editor.append(line);
        }
        this.savedRange = undefined;
        this.hideSelectionTools();
    }

    private captureSelection(showTools: boolean) {
        const selection = window.getSelection();
        const editor = document.querySelector("#news-editor-content");
        if (!selection?.rangeCount || !editor) return;
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
            this.savedRange = range.cloneRange();
            if (range.collapsed) {
                this.hideSelectionTools();
            } else if (showTools) {
                this.showSelectionTools(range);
            }
        }
    }

    private showSelectionTools(range: Range) {
        const panel = document.querySelector<HTMLElement>(".news-compose-panel");
        const tools = $("#news-selection-tools");
        if (!panel) return;

        this.closeSelectionMenus();
        tools.show();
        this.positionSelectionTools(range);
    }

    private positionSelectionTools(range: Range) {
        const panel = document.querySelector<HTMLElement>(".news-compose-panel");
        const manager = document.querySelector<HTMLElement>("#news-manager");
        const tools = $("#news-selection-tools");
        if (!panel || !manager || !tools.is(":visible")) return;

        const selectionRect = range.getClientRects()[0] ?? range.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const managerRect = manager.getBoundingClientRect();
        const toolWidth = tools.outerWidth() ?? 285;
        const toolHeight = tools.outerHeight() ?? 42;
        const edge = 6;
        const desiredLeft = selectionRect.left + selectionRect.width / 2 - toolWidth / 2;
        const viewportLeft = Math.max(
            managerRect.left + edge,
            Math.min(desiredLeft, managerRect.right - toolWidth - edge),
        );
        const aboveTop = selectionRect.top - toolHeight - 8;
        const belowTop = selectionRect.bottom + 8;
        const fitsAbove = aboveTop >= managerRect.top + edge;
        const fitsBelow = belowTop + toolHeight <= managerRect.bottom - edge;
        let viewportTop = fitsAbove || !fitsBelow ? aboveTop : belowTop;
        viewportTop = Math.max(
            managerRect.top + edge,
            Math.min(viewportTop, managerRect.bottom - toolHeight - edge),
        );

        tools.css({
            left: viewportLeft - panelRect.left,
            top: viewportTop - panelRect.top,
        });
    }

    private hideSelectionTools() {
        $("#news-selection-tools").hide();
        this.closeSelectionMenus();
    }

    private closeSelectionMenus() {
        $("#news-color-palette, #news-link-editor").hide();
    }

    private restoreSelection() {
        if (!this.savedRange) return false;
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(this.savedRange);
        return true;
    }

    private openColorPalette() {
        const selectedRange = this.savedRange;
        if (!selectedRange || selectedRange.collapsed || !this.restoreSelection()) {
            this.setStatus("Select some text first", true);
            this.hideSelectionTools();
            return;
        }
        $("#news-link-editor").hide();
        $("#news-color-palette").css("display", "flex");
        this.positionSelectionTools(selectedRange);
    }

    private applyColor(selectedColor?: string) {
        if (!this.savedRange || this.savedRange.collapsed || !this.restoreSelection()) {
            this.setStatus("Select some text first", true);
            return;
        }
        const color = selectedColor ?? String($("#news-editor-color").val() || "#ffd700");
        document.execCommand("styleWithCSS", false, "true");
        document.execCommand("foreColor", false, color);
        this.captureSelection(false);
        this.hideSelectionTools();
        this.setStatus("Color applied");
    }

    private openLinkEditor() {
        if (!this.savedRange || this.savedRange.collapsed || !this.restoreSelection()) {
            this.setStatus("Select some text first", true);
            this.hideSelectionTools();
            return;
        }
        const selection = window.getSelection();
        $("#news-link-text").val(selection?.toString() || "");
        $("#news-link-url").val("");
        $("#news-color-palette").hide();
        $("#news-link-editor").css("display", "grid");
        this.positionSelectionTools(this.savedRange);
        $("#news-link-url").trigger("focus");
    }

    private closeLinkEditor() {
        $("#news-link-editor").hide();
        if (this.savedRange) this.positionSelectionTools(this.savedRange);
    }

    private applyLink() {
        const label = String($("#news-link-text").val() || "").trim();
        const url = safeLinkUrl(String($("#news-link-url").val() || "").trim());
        if (!label || !url || !this.restoreSelection()) {
            this.setStatus("Enter link text and a valid HTTP or HTTPS URL", true);
            return;
        }

        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
        if (!range) return;
        range.deleteContents();
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = label;
        range.insertNode(anchor);
        range.setStartAfter(anchor);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        this.savedRange = range.cloneRange();
        this.hideSelectionTools();
        this.setStatus("Link added");
    }

    private serializeEditor(): NewsDocument {
        const editor = document.querySelector("#news-editor-content");
        if (!editor) return { paragraphs: [{ runs: [] }] };
        const rawRuns: NewsRun[] = [];

        const appendRun = (run: NewsRun) => {
            if (!run.text) return;
            const previous = rawRuns.at(-1);
            if (
                previous &&
                previous.color === run.color &&
                previous.linkUrl === run.linkUrl
            ) {
                previous.text += run.text;
            } else {
                rawRuns.push(run);
            }
        };
        const appendNewline = () => {
            const previous = rawRuns.at(-1);
            if (!previous || previous.text.endsWith("\n")) return;
            previous.text += "\n";
        };
        const walk = (node: Node, inherited: Omit<NewsRun, "text"> = {}) => {
            if (node.nodeType === Node.TEXT_NODE) {
                appendRun({ ...inherited, text: node.textContent || "" });
                return;
            }
            if (!(node instanceof HTMLElement)) return;
            if (node.tagName === "BR") {
                appendNewline();
                return;
            }

            const marks = { ...inherited };
            if (node instanceof HTMLAnchorElement) {
                marks.linkUrl = safeLinkUrl(node.href);
            }
            const inlineColor =
                node.style.color ||
                (node.tagName === "FONT" ? node.getAttribute("color") || "" : "");
            marks.color = normalizeColor(inlineColor) ?? marks.color;
            for (const child of Array.from(node.childNodes)) walk(child, marks);
            if (["DIV", "P"].includes(node.tagName)) appendNewline();
        };
        for (const child of Array.from(editor.childNodes)) walk(child);

        const paragraphs: NewsDocument["paragraphs"] = [{ runs: [] }];
        for (const run of rawRuns) {
            const parts = run.text.split("\n");
            for (const [index, text] of parts.entries()) {
                if (text) paragraphs.at(-1)!.runs.push({ ...run, text });
                if (index < parts.length - 1) paragraphs.push({ runs: [] });
            }
        }
        while (paragraphs.length > 1 && !paragraphs.at(-1)!.runs.length) paragraphs.pop();
        return { paragraphs };
    }

    private async save(publish: boolean) {
        const title = String($("#news-editor-title").val() || "").trim();
        const dateText = String($("#news-editor-date").val() || "").trim();
        const newsDocument = this.serializeEditor();
        const hasText = newsDocument.paragraphs.some((paragraph) =>
            paragraph.runs.some((run) => run.text.trim()),
        );
        if (!title || !dateText || !hasText) {
            this.setStatus("Add a title, displayed date, and some news text", true);
            return;
        }

        this.setBusy(true);
        this.setStatus("Saving…");
        try {
            const payload: SaveNewsRequest = {
                id: this.selectedId,
                title,
                dateText,
                document: newsDocument,
                publish,
            };
            const result = await this.request<{
                success: true;
                id: number;
                published: boolean;
            }>("/save", payload);
            this.selectedId = result.id;
            await this.loadPosts(result.id);
            await this.onNewsChanged();
            this.setStatus(result.published ? "Published" : "Draft saved");
        } catch (error) {
            this.setStatus(
                error instanceof Error ? error.message : "Could not save news",
                true,
            );
        } finally {
            this.setBusy(false);
        }
    }

    private async deletePost() {
        if (!this.selectedId) return;
        const title = String($("#news-editor-title").val() || "this post").trim();
        if (!window.confirm(`Delete “${title}” permanently? This cannot be undone.`))
            return;

        this.setBusy(true);
        this.setStatus("Deleting…");
        try {
            await this.request<{ success: true }>("/delete", { id: this.selectedId });
            this.selectedId = undefined;
            await this.loadPosts();
            await this.onNewsChanged();
            this.setStatus("Post deleted");
        } catch (error) {
            this.setStatus(
                error instanceof Error ? error.message : "Could not delete news",
                true,
            );
        } finally {
            this.setBusy(false);
        }
    }

    private setBusy(busy: boolean) {
        $(
            "#news-editor-save-draft, #news-editor-publish, #news-editor-delete, #news-editor-new",
        ).prop("disabled", busy);
    }

    private setStatus(message: string, error = false) {
        $("#news-editor-status").text(message).toggleClass("error", error);
    }
}
