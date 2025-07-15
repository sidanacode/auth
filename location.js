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
  if (!latestData) {
    alert("⚠️ Please select a location first.");
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    alert("🚫 User not authenticated!");
    return;
  }

  user.getIdToken()
    .then((token) => {
      fetch(" http://127.0.0.1:8000/register_user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // 🔐 Secure token
        },
        body: JSON.stringify(latestData)
      })
        .then(res => res.json())
        .then(response => {
          console.log("✅ API Response:", response);
          alert("✅ Data saved successfully!");
        })
        .catch(error => {
          console.error("❌ Error sending to API:", error);
          alert("❌ Failed to save data.");
        });
    });
}
