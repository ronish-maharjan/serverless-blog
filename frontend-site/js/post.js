async function loadPost() {
    const container = document.querySelector("#post");

    const params = new URLSearchParams(
        window.location.search
    );

    const id = params.get("id");

    if (!id) {
        container.textContent = "Post ID is missing.";
        return;
    }

    try {
        const response = await fetch(
            `/api/posts/${encodeURIComponent(id)}`
        );

        if (!response.ok) {
            throw new Error("Post not found");
        }

        const post = await response.json();

        const title = document.createElement("h1");
        title.textContent = post.title;

        const meta = document.createElement("p");
        meta.className = "post-date";
        meta.textContent =
            new Date(post.createdAt).toLocaleString();

        const content = document.createElement("div");
        content.className = "post-content";
        content.style.whiteSpace = "pre-wrap";
        content.textContent = post.content;

        container.replaceChildren(
            title,
            meta,
            content
        );

    } catch (error) {
        console.error(error);

        container.textContent =
            "Could not load this post.";
    }
}

loadPost();

