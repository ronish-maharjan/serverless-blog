async function loadPosts() {
    const container = document.querySelector("#posts");

    try {
        const response = await fetch("/api/posts");

        if (!response.ok) {
            throw new Error("Failed to load posts");
        }

        const posts = await response.json();

        if (posts.length === 0) {
            container.textContent = "No posts yet.";
            return;
        }

        container.replaceChildren();

        for (const post of posts) {
            if (!post.published) {
                continue;
            }

            const article = document.createElement("article");
            article.className = "post-card";

            const title = document.createElement("h2");
            title.textContent = post.title;

            const date = document.createElement("p");
            date.className = "post-date";
            date.textContent =
                new Date(post.createdAt).toLocaleDateString();

            const excerpt = document.createElement("p");
            excerpt.textContent =
                post.excerpt || post.content.slice(0, 180);

            const link = document.createElement("a");
            link.href = `/post.html?id=${encodeURIComponent(post.id)}`;
            link.textContent = "Read post →";

            article.append(
                title,
                date,
                excerpt,
                link
            );

            container.append(article);
        }

    } catch (error) {
        console.error(error);

        container.textContent =
            "Could not load blog posts.";
    }
}

loadPosts();

