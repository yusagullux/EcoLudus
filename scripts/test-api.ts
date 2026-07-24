async function testSignup() {
  console.log("Testing API signup endpoint...");
  try {
    const signupResponse = await fetch("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test_endpoint_" + Date.now() + "@example.com",
        password: "password123",
        displayName: "API Tester"
      })
    });

    console.log("Signup status:", signupResponse.status);
    const signupData = await signupResponse.json();
    console.log("Signup data:", signupData);

    return signupData;
  } catch (err) {
    console.error("Signup fetch failed:", err);
  }
}

async function testLogin(email: string) {
  console.log("Testing API login endpoint...");
  try {
    const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: "password123"
      })
    });

    console.log("Login status:", loginResponse.status);
    const loginData = await loginResponse.json();
    console.log("Login data:", loginData);
  } catch (err) {
    console.error("Login fetch failed:", err);
  }
}

async function run() {
  const data = await testSignup();
  if (data?.user?.email) {
    await testLogin(data.user.email);
  }
}

run();
