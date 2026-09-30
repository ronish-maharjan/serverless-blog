const token = sessionStorage.getItem("idToken");

if (!token) {
    window.location.href = "/login.html";
}

const form = document.querySelector("#post-form");
const message = document.querySelector("#message");
const postsContainer =
    document.querySelector("#admin-posts");

const cancelEditButton =
    document.querySelector("#cancel-edit");

const logoutButton =
    document.querySelector("#logout");

function authHeaders() {
    return {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
    };
}

function resetForm() {
    document.querySelector("#post-id").value = "";
    document.querySelector("#title").value = "";
    document.querySelector("#excerpt").value = "";
    document.querySelector("#content").value = "";
    document.querySelector("#published").checked = true;
}

async function loadPosts() {
    try {
        const response = await fetch(
            "/api/posts"
        );

        if (!response.ok) {
            throw new Error("Failed to load posts");
        }

        const posts = await response.json();

        postsContainer.replaceChildren();

        if (posts.length === 0) {
            postsContainer.textContent = "No posts.";
            return;
        }

        for (const post of posts) {
            const item = document.createElement("article");
            item.className = "post-card";

            const title = document.createElement("h3");
            title.textContent = post.title;

            const status = document.createElement("p");
            status.textContent =
                post.published
                    ? "Published"
                    : "Draft";

            const edit = document.createElement("button");
            edit.textContent = "Edit";

            edit.addEventListener(
                "click",
                () => startEditing(post)
            );

            const remove = document.createElement("button");
            remove.textContent = "Delete";
            remove.className = "danger";

            remove.addEventListener(
                "click",
                () => deletePost(post.id)
            );

            item.append(
                title,
                status,
                edit,
                remove
            );

            postsContainer.append(item);
        }

    } catch (error) {
        console.error(error);

        message.textContent =
            "Could not load posts.";
    }
}

function startEditing(post) {
    document.querySelector("#post-id").value =
        post.id;

    document.querySelector("#title").value =
        post.title;

    document.querySelector("#excerpt").value =
        post.excerpt || "";

    document.querySelector("#content").value =
        post.content;

    document.querySelector("#published").checked =
        Boolean(post.published);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

async function deletePost(id) {
    const confirmed = window.confirm(
        "Delete this post?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `/api/posts/${encodeURIComponent(id)}`,
            {
                method: "DELETE",
                headers: authHeaders()
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Delete failed"
            );
        }

        message.textContent =
            "Post deleted.";

        await loadPosts();

    } catch (error) {
        console.error(error);

        message.textContent =
            error.message || "Delete failed";
    }
}

form.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const id =
            document.querySelector("#post-id").value;

        const payload = {
            title:
                document.querySelector("#title").value,

            excerpt:
                document.querySelector("#excerpt").value,

            content:
                document.querySelector("#content").value,

            published:
                document.querySelector("#published").checked
        };

        const method = id
            ? "PUT"
            : "POST";

        const endpoint = id
            ? `/api/posts/${encodeURIComponent(id)}`
            : "/api/posts";

        try {
            const response = await fetch(
                endpoint,
                {
                    method,
                    headers: authHeaders(),
                    body: JSON.stringify(payload)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Save failed"
                );
            }

            message.textContent =
                id
                    ? "Post updated."
                    : "Post created.";

            resetForm();

            await loadPosts();

        } catch (error) {
            console.error(error);

            message.textContent =
                error.message || "Save failed";
        }
    }
);

cancelEditButton.addEventListener(
    "click",
    resetForm
);

logoutButton.addEventListener(
    "click",
    () => {
        sessionStorage.removeItem("idToken");

        window.location.href =
            "/login.html";
    }
);

loadPosts();

