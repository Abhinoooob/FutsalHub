document.addEventListener("DOMContentLoaded", () => {
  const openLoginButton = document.getElementById("openLogin")
  const loginModal = document.getElementById("loginModal")
  const closeLoginButton = document.getElementById("closeLogin")
  const loginFormContainer = document.getElementById("loginFormContainer")
  const registerForm = document.getElementById("registerForm")
  const showRegisterLink = document.getElementById("showRegister")
  const showLoginLink = document.getElementById("showLogin")
  const loginForm = document.getElementById("loginForm")
  const registerFormContent = document.getElementById("registerFormContent")

  openLoginButton.addEventListener("click", () => {
    loginModal.style.display = "flex"
  })

  closeLoginButton.addEventListener("click", () => {
    loginModal.style.display = "none"
  })

  showRegisterLink.addEventListener("click", () => {
    loginFormContainer.style.display = "none"
    registerForm.style.display = "block"
  })

  showLoginLink.addEventListener("click", () => {
    loginFormContainer.style.display = "block"
    registerForm.style.display = "none"
  })

  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.style.display = "none"
    }
  })

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const username = document.getElementById("loginUsername").value
    const password = document.getElementById("loginPassword").value

    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      if (data.message === "Login successful") {
        localStorage.setItem("user", JSON.stringify(data.user))
        localStorage.setItem("token", data.token);
        window.location.href = "dashboard.html"
      } else {
        alert(data.message)
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Login failed. Please try again.")
    }
  })

  registerFormContent.addEventListener("submit", async (event) => {
    event.preventDefault()
    const username = document.getElementById("registerUsername").value
    const email = document.getElementById("registerEmail").value
    const password = document.getElementById("registerPassword").value

    try {
      const response = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      })
      const data = await response.json()
      alert(data.message)
      if (data.message === "User registered successfully") {
        registerFormContent.reset()
        loginFormContainer.style.display = "block"
        registerForm.style.display = "none"
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Registration failed. Please try again.")
    }
  })
})