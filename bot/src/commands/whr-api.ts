export async function readWhrResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const text = await response.text();
        let message = text;
        try {
            const body = JSON.parse(text);
            message = body.error ?? body.message ?? text;
        } catch {
            // Hono HTTP exceptions may use plain text.
        }
        throw new Error(
            response.status < 500
                ? message
                : "The rating service could not complete this request. Try again later.",
        );
    }
    return response.json() as Promise<T>;
}
