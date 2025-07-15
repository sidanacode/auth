let map;
let marker;
let geocoder;
let latestData = null; // store latest user+location info

window.onload = () => {
  geocoder = new google.maps.Geocoder();

  // ✅ Firebase login check
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      console.log("✅ Firebase user logged in:", user.phoneNumber);
      document.getElementById("phone").value = user.phoneNumber || "";
    } else {
      alert("🚫 User not logged in!");
    }
  });

  // 🗺️ Initialize map
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 26.9124, lng: 75.7873 }, // Default: Jaipur
    zoom: 13,
  });

  // 📍 Map click listener
  map.addListener("click", (e) => {
    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    if (!name) return alert("Please enter your name first.");

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    placeMarkerAndFetchAddress(lat, lng, name, phone);
  });
};

// 📌 Use GPS location
function useCurrentLocation() {
  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value;
  if (!name) return alert("Please enter your name before using current location.");

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setCenter({ lat, lng });
        placeMarkerAndFetchAddress(lat, lng, name, phone);
      },
      (error) => {
        alert("Failed to get location: " + error.message);
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

// 📍 Place marker and reverse geocode
function placeMarkerAndFetchAddress(lat, lng, name, phone) {
  if (marker) marker.setMap(null);

  // ✅ Regular marker (still works fine)
  marker = new google.maps.Marker({
    position: { lat, lng },
    map: map,
    title: "Selected Location",
  });

  geocoder.geocode({ location: { lat, lng } }, (results, status) => {
    if (status === "OK" && results[0]) {
      const result = results[0];
      const components = result.address_components;

      const getComponent = (type) => {
        const comp = components.find((c) => c.types.includes(type));
        return comp ? comp.long_name : "";
      };

      const addressData = {
        name: name,
        mobile: phone,
        latitude: lat,
        longitude: lng,
        full_address: result.formatted_address,
        street_number: getComponent("street_number"),
        street_name: getComponent("route") || getComponent("sublocality_level_1"),
        neighborhood: getComponent("sublocality") || getComponent("neighborhood"),
        city: getComponent("locality") || getComponent("administrative_area_level_2"),
        state: getComponent("administrative_area_level_1"),
        country: getComponent("country"),
        postal_code: getComponent("postal_code"),
        place_id: result.place_id,
      };

      latestData = addressData;

      // Show on screen
      document.getElementById("lat").innerText = lat.toFixed(6);
      document.getElementById("lng").innerText = lng.toFixed(6);
      document.getElementById("address").innerText = addressData.full_address;
      document.getElementById("street_number").innerText = addressData.street_number;
      document.getElementById("street_name").innerText = addressData.street_name;
      document.getElementById("neighborhood").innerText = addressData.neighborhood;
      document.getElementById("city").innerText = addressData.city;
      document.getElementById("state").innerText = addressData.state;
      document.getElementById("country").innerText = addressData.country;
      document.getElementById("postal_code").innerText = addressData.postal_code;
      document.getElementById("place_id").innerText = addressData.place_id;
      document.getElementById("json_output").innerText = JSON.stringify(addressData, null, 2);
    } else {
      alert("Address not found.");
    }
  });
}

// 💾 Save data with token
function saveData() {
  // ✅ VALIDATION CHECK: Ensure location data exists
  if (!latestData) {
    alert("⚠️ Please select a location first.");
    return;
  }

  // 🐛 MISTAKE #1 FIX: Get user input data that was missing in original code
  // ORIGINAL PROBLEM: The original code was only sending latestData (address info)
  // but the backend expects a RegisterUser model with BOTH user and address data
  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value;
  
  // ✅ VALIDATION CHECK: Ensure user entered their name
  // ORIGINAL PROBLEM: No validation for required user input
  if (!name) {
    alert("⚠️ Please enter your name first.");
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    alert("🚫 User not authenticated!");
    return;
  }

  // 🔧 MISTAKE #2 FIX: Create proper payload structure
  // ORIGINAL PROBLEM: Was sending JSON.stringify(latestData) which only contained address
  // BACKEND EXPECTS: RegisterUser model = { user: UserIn, address: UserAddressIn }
  // 
  // What was being sent before:
  // {
  //   latitude: 123,
  //   longitude: 456,
  //   full_address: "...",
  //   // ... only address fields
  // }
  //
  // What backend actually needs (RegisterUser model):
  // {
  //   user: { name: "...", mobile_number: "..." },
  //   address: { latitude: 123, longitude: 456, ... }
  // }
  const payload = {
    user: {
      name: name,               // ← This was completely missing before
      mobile_number: phone     // ← This was completely missing before
    },
    address: {
      // ✅ Properly structure address data to match UserAddressIn model
      latitude: latestData.latitude,
      longitude: latestData.longitude,
      full_address: latestData.full_address,
      street_number: latestData.street_number,
      street_name: latestData.street_name,
      neighborhood: latestData.neighborhood
    }
  };

  console.log("📤 Sending payload:", payload);

  user.getIdToken()
    .then((token) => {
      // 🐛 MISTAKE #3 FIX: Removed extra space in URL
      // ORIGINAL: fetch(" http://127.0.0.1:8000/register_user", {
      // FIXED:    fetch("http://127.0.0.1:8000/register_user", {
      fetch("http://127.0.0.1:8000/register_user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // 🔐 Secure token
        },
        // 🔧 MISTAKE #2 FIX: Send properly structured payload instead of just latestData
        body: JSON.stringify(payload)  // ← Was: JSON.stringify(latestData)
      })
        // 🔧 MISTAKE #4 FIX: Add proper HTTP status checking
        // ORIGINAL PROBLEM: Was doing .then(res => res.json()) without checking if request succeeded
        // This meant 401 Unauthorized, 422 Validation Error, etc. would be treated as "success"
        .then(res => {
          if (!res.ok) {
            // ✅ Now we properly catch HTTP errors (401, 422, 500, etc.)
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(response => {
          console.log("✅ API Response:", response);
          alert("✅ User registered successfully!");
          
          // Optional: Redirect or show success page
          // window.location.href = "success.html";
        })
        // 🔧 MISTAKE #4 FIX: Better error handling with specific error messages
        // ORIGINAL: Just showed generic "Failed to save data"
        // NOW: Shows specific error message to help debug issues
        .catch(error => {
          console.error("❌ Error sending to API:", error);
          alert("❌ Failed to save data: " + error.message);
        });
    })
    // 🔧 MISTAKE #5 FIX: Handle Firebase token errors separately
    // ORIGINAL: No separate handling for Firebase auth token issues
    .catch(error => {
      console.error("❌ Error getting Firebase token:", error);
      alert("❌ Authentication error: " + error.message);
    });
}

// 👤 Get user data from API
// 🆕 NEW FEATURE: Added this function to test the secured get_user endpoint
// ORIGINAL PROBLEM: No way to test if the authentication and data retrieval worked
function getUserData() {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("🚫 User not authenticated!");
    return;
  }

  user.getIdToken()
    .then((token) => {
      // 🔐 Call the secured get_user endpoint
      // This endpoint uses the Firebase token to identify which user's data to return
      fetch("http://127.0.0.1:8000/get_user", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}` // 🔐 Secure token
        }
      })
        // ✅ Proper HTTP status checking (same pattern as saveData)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(response => {
          console.log("✅ User Data:", response);
          // Display the fetched user data in the UI
          document.getElementById("user_data_output").innerText = JSON.stringify(response, null, 2);
        })
        // ✅ Proper error handling
        .catch(error => {
          console.error("❌ Error fetching user data:", error);
          document.getElementById("user_data_output").innerText = `❌ Error: ${error.message}`;
        });
    })
    // ✅ Handle Firebase token errors
    .catch(error => {
      console.error("❌ Error getting Firebase token:", error);
      alert("❌ Authentication error: " + error.message);
    });
}
