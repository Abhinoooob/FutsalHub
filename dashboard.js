document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const userInfoDiv = document.querySelector(".user-info");
    const userIcon = userInfoDiv.querySelector(".user-icon");
    const usernameSpan = userInfoDiv.querySelector(".username");
    const logoutButton = document.getElementById("logout");
    const bookingDateInput = document.getElementById("bookingDate");
    const locationSelect = document.getElementById("location");
    const sortSelect = document.getElementById("sortSelect");
    const courtSelect = document.getElementById("courtSelect");
    const timeSlotsDiv = document.getElementById("timeSlots");
    const bookFutsalButton = document.getElementById("bookFutsal");
    const bookingsDiv = document.getElementById("bookings");
    const token = localStorage.getItem("token");

    userIcon.textContent = user.username[0].toUpperCase();
    usernameSpan.textContent = user.username;

    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        window.location.href = "index.html";
    });

    let selectedCourt = null;
    let selectedTimeSlot = null;
    let allBookings = [];

    // Restrict date input to today or future dates
    const currentDate = new Date();
    const currentDateString = currentDate.toISOString().split("T")[0];
    bookingDateInput.setAttribute("min", currentDateString);

    // Fetch existing bookings
    function fetchBookings() {
        fetch(`http://localhost:5000/api/bookings`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                allBookings = data;
                applyBookingSort();
            })
            .catch((error) => {
                console.error("Error fetching bookings:", error);
                bookingsDiv.innerHTML = "<p>Error fetching bookings. Please try again.</p>";
            });
    }

    // Apply sorting to bookings using Merge Sort
    function applyBookingSort() {
        const bookingSort = document.getElementById("bookingSort");
        if (!bookingSort) return;

        const sortBy = bookingSort.value;
        const sortedBookings = mergeSort([...allBookings], sortBy);
        displayBookings(sortedBookings);
    }

    // Merge Sort implementation for bookings
    function mergeSort(arr, sortBy) {
        if (arr.length <= 1) return arr;

        const mid = Math.floor(arr.length / 2);
        const left = mergeSort(arr.slice(0, mid), sortBy);
        const right = mergeSort(arr.slice(mid), sortBy);
        return merge(left, right, sortBy);
    }

    function merge(left, right, sortBy) {
        let result = [];
        let i = 0,
            j = 0;

        while (i < left.length && j < right.length) {
            const leftDate = sortBy === "booked_time" ? new Date(left[i].created_at) : new Date(left[i].booking_date);
            const rightDate = sortBy === "booked_time" ? new Date(right[j].created_at) : new Date(right[j].booking_date);

            if (leftDate > rightDate) {
                result.push(left[i]);
                i++;
            } else {
                result.push(right[j]);
                j++;
            }
        }

        return result.concat(left.slice(i)).concat(right.slice(j));
    }

    // Display sorted bookings
    function displayBookings(bookings) {
        if (bookings.length > 0) {
            bookingsDiv.innerHTML = bookings
                .map(
                    (booking) => `
                    <div class="booking-item">
                        <p><strong>Court:</strong> ${booking.court_name}</p>
                        <p><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
                        <p><strong>Booked at:</strong> ${new Date(booking.created_at).toLocaleString()}</p>
                    </div>`
                )
                .join("");
        } else {
            bookingsDiv.innerHTML = "<p>No bookings found.</p>";
        }
    }

    // Fetch courts and populate the dropdown with Insertion Sort
    function fetchCourts() {
        const location = locationSelect.value;

        if (location) {
            fetch(`http://localhost:5000/api/futsal-courts?location=${location}`)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then((courts) => {
                    // Convert hourly_rate to a number
                    const courtsWithNumbers = courts.map(court => ({
                        ...court,
                        hourly_rate: Number(court.hourly_rate)
                    }));

                    // Sort courts using Insertion Sort
                    const sortedCourts = insertionSort([...courtsWithNumbers], sortSelect.value);

                    // Populate the court dropdown
                    courtSelect.innerHTML =
                        '<option value="">Select court</option>' +
                        sortedCourts
                            .map(
                                (court) =>
                                    `<option value="${court.id}">${court.name} - रू${court.hourly_rate.toFixed(2)}/hour</option>`
                            )
                            .join("");
                    courtSelect.style.display = "inline-block";
                })
                .catch((error) => {
                    console.error("Error fetching courts:", error);
                    alert(`Error fetching courts: ${error.message}. Please try again.`);
                });
        } else {
            courtSelect.style.display = "none";
            courtSelect.innerHTML = '<option value="">Select court</option>';
        }
    }

    // Insertion Sort implementation for courts
    function insertionSort(arr, sortOrder) {
        const n = arr.length;
        for (let i = 1; i < n; i++) {
            let current = arr[i];
            let j = i - 1;

            while (j >= 0 && compareCourts(arr[j], current, sortOrder)) {
                arr[j + 1] = arr[j];
                j--;
            }
            arr[j + 1] = current;
        }

        // Log the sorted array for debugging
        console.log("Sorted Courts:", arr);
        return arr;
    }

    // Compare courts based on sort order
    function compareCourts(a, b, sortOrder) {
        if (sortOrder === "price_asc") {
            return a.hourly_rate > b.hourly_rate; // Sort low to high
        } else if (sortOrder === "price_desc") {
            return a.hourly_rate < b.hourly_rate; // Sort high to low
        }
        return false; // No sorting
    }

    // Fetch time slots
    function fetchTimeSlots() {
        const date = bookingDateInput.value;
        if (date && selectedCourt) {
            fetch(`http://localhost:5000/api/time-slots?date=${date}&courtId=${selectedCourt}`)
                .then((response) => response.json())
                .then((slots) => {
                    const now = new Date();
                    const selectedDate = new Date(date);
                    const isToday = selectedDate.toDateString() === now.toDateString();

                    timeSlotsDiv.innerHTML = slots
                        .map((slot) => {
                            const slotTime = new Date(date + "T" + slot.start);
                            const isPast = isToday && slotTime < now;
                            const isBooked = slot.isBooked;
                            return `
                            <div class="time-slot ${isPast || isBooked ? "disabled" : ""}" 
                                 data-start="${slot.start}" 
                                 data-end="${slot.end}"
                                 ${isPast || isBooked ? "disabled" : ""}>
                              ${slot.start} - ${slot.end}
                            </div>`;
                        })
                        .join("");
                    addTimeSlotListeners();
                })
                .catch((error) => {
                    console.error("Error fetching time slots:", error);
                    timeSlotsDiv.innerHTML = "<p>Error fetching time slots. Please try again.</p>";
                });
        }
    }

    function addTimeSlotListeners() {
        const timeSlots = timeSlotsDiv.querySelectorAll(".time-slot:not(.disabled)");
        timeSlots.forEach((slot) => {
            slot.addEventListener("click", () => {
                timeSlots.forEach((s) => s.classList.remove("selected"));
                slot.classList.add("selected");
                selectedTimeSlot = {
                    start_time: slot.dataset.start,
                    end_time: slot.dataset.end,
                };
                bookFutsalButton.disabled = false;
            });
        });
    }

    // Event listeners
    bookingDateInput.addEventListener("change", () => {
        locationSelect.disabled = false;
        locationSelect.value = "";
        sortSelect.disabled = true;
        courtSelect.innerHTML = '<option value="">Select court</option>';
        courtSelect.style.display = "none";
        timeSlotsDiv.innerHTML = "";
        selectedCourt = null;
        selectedTimeSlot = null;
        bookFutsalButton.disabled = true;
    });

    locationSelect.addEventListener("change", () => {
        sortSelect.disabled = false; // Enable the sort dropdown
        courtSelect.style.display = "inline-block"; // Show the court dropdown
        fetchCourts(); // Fetch courts for the selected location
    });

    sortSelect.addEventListener("change", fetchCourts);

    courtSelect.addEventListener("change", () => {
        selectedCourt = courtSelect.value;
        timeSlotsDiv.innerHTML = "";
        selectedTimeSlot = null;
        bookFutsalButton.disabled = true;
        if (selectedCourt && bookingDateInput.value) {
            fetchTimeSlots();
        }
    });

    bookFutsalButton.addEventListener("click", () => {
        if (!selectedCourt || !selectedTimeSlot || !bookingDateInput.value) {
            alert("Please select a court, date, and time slot.");
            return;
        }

        fetch("http://localhost:5000/api/book", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                courtId: selectedCourt,
                date: bookingDateInput.value,
                startTime: selectedTimeSlot.start_time,
                endTime: selectedTimeSlot.end_time,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    return response.json().then((err) => {
                        throw err;
                    });
                }
                return response.json();
            })
            .then((data) => {
                alert(data.message);
                if (data.message === "Booking successful") {
                    fetchBookings();
                    resetBookingForm();
                }
            })
            .catch((error) => {
                console.error("Error booking ground:", error);
                alert(`An error occurred while booking: ${error.message || "Please try again."}`);
            });
    });

    function resetBookingForm() {
        bookingDateInput.value = "";
        locationSelect.value = "";
        locationSelect.disabled = true;
        sortSelect.value = "";
        sortSelect.disabled = true;
        courtSelect.style.display = "none";
        courtSelect.innerHTML = '<option value="">Select court</option>';
        timeSlotsDiv.innerHTML = "";
        selectedCourt = null;
        selectedTimeSlot = null;
        bookFutsalButton.disabled = true;
    }

    // Initial fetch of bookings
    fetchBookings();

    // Add event listener for booking sort change
    const bookingSort = document.getElementById("bookingSort");
    if (bookingSort) {
        bookingSort.addEventListener("change", applyBookingSort);
    }
});