const form = document.querySelector("#login-form");
const message = document.querySelector("#login-message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "Logging in...";

    const username =
        document.querySelector("#username").value;

    const password =
        document.querySelector("#password").value;

    try {
        const response = await fetch(
            "/api/auth/login",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    password
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Login failed"
            );
        }

        sessionStorage.setItem(
            "idToken",
            result.token
        );

        window.location.href = "/admin.html";

    } catch (error) {
        console.error(error);

        message.textContent =
            error.message || "Login failed";
    }
});

