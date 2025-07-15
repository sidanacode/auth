const auth = firebase.auth();
let confirmationResult = null;

// Setup invisible reCAPTCHA
window.onload = () => {
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    size: 'invisible',
    callback: () => {
      sendOTP();
    }
  });
  recaptchaVerifier.render();
};

// Send OTP
function sendOTP() {
  const phone = document.getElementById("phone").value;
  auth.signInWithPhoneNumber(phone, window.recaptchaVerifier)
    .then((result) => {
      confirmationResult = result;
      alert("OTP Sent Successfully!");
    })
    .catch((error) => {
      alert("Error sending OTP: " + error.message);
    });
}

// Verify OTP
function verifyOTP() {
  const code = document.getElementById("otp").value;
  confirmationResult.confirm(code)
    .then(() => {
      const phone = document.getElementById("phone").value;
      localStorage.setItem("user_phone", phone);  // ✅ Save number for later use

      alert("Login Successful! Redirecting...");
      window.location.href = "location.html";
    })
    .catch((error) => {
      alert("Invalid OTP: " + error.message);
    });
}