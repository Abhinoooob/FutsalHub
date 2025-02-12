const express = require("express")
const mysql = require("mysql2/promise")
const bodyParser = require("body-parser")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cors = require("cors")
require("dotenv").config()

const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(bodyParser.json())
app.use(cors())

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

// Helper function to execute SQL queries
const query = async (sql, params) => {
  const [rows] = await pool.execute(sql, params)
  return rows
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers["authorization"]
  if (typeof bearerHeader !== "undefined") {
    const bearer = bearerHeader.split(" ")
    const bearerToken = bearer[1]
    req.token = bearerToken
    jwt.verify(bearerToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "Unauthorized" })
      }
      req.userId = decoded.id
      next()
    })
  } else {
    res.status(403).json({ message: "No token provided" })
  }
}

// Register Route
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body

  try {
    const existingUser = await query("SELECT id FROM users WHERE username = ? OR email = ?", [username, email])
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Username or email already taken" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    await query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hashedPassword])
    res.status(201).json({ message: "User registered successfully" })
  } catch (error) {
    console.error("Error in registration:", error)
    res.status(500).json({ message: "Registration failed" })
  }
})

// Login Route
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body

  try {
    const users = await query("SELECT * FROM users WHERE username = ?", [username])
    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid username or password" })
    }

    const user = users[0]
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid username or password" })
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "24h" })

    res.status(200).json({
      message: "Login successful",
      user: { id: user.id, username: user.username, email: user.email },
      token,
    })
  } catch (error) {
    console.error("Error in login:", error)
    res.status(500).json({ message: "Login failed" })
  }
})

// Fetch Bookings (Requires Authentication)
app.get("/api/bookings", verifyToken, async (req, res) => {
  try {
      const bookings = await query(
          `SELECT b.*, c.name as court_name 
           FROM bookings b 
           JOIN futsal_courts c ON b.court_id = c.id 
           WHERE b.user_id = ?
           ORDER BY created_at DESC`, // Default sorting by booking time
          [req.userId]
      );
      res.status(200).json(bookings);
  } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

// Fetch futsal courts by location with optional sorting
app.get("/api/futsal-courts", async (req, res) => {
  const { location, sort } = req.query

  if (!location) {
    return res.status(400).json({ message: "Location is required" })
  }

  try {
    let sql =
      "SELECT id, name, location, CAST(hourly_rate AS DECIMAL(10,2)) AS hourly_rate FROM futsal_courts WHERE location = ?"
    const queryParams = [location]

    if (sort === "price_asc") {
      sql += " ORDER BY hourly_rate ASC"
    } else if (sort === "price_desc") {
      sql += " ORDER BY hourly_rate DESC"
    }

    console.log("Executing SQL query:", sql)
    console.log("Query parameters:", queryParams)

    const courts = await query(sql, queryParams)

    console.log("Query result:", courts)

    res.status(200).json(courts)
  } catch (error) {
    console.error("Error fetching futsal courts:", error)
    res.status(500).json({ message: "Failed to fetch futsal courts", error: error.message })
  }
})

// Generate time slots with booking information
app.get("/api/time-slots", async (req, res) => {
  const { date, courtId } = req.query

  if (!date || !courtId) {
    return res.status(400).json({ message: "Date and courtId are required" })
  }

  try {
    const startTime = new Date(`${date}T06:00:00`)
    const endTime = new Date(`${date}T20:00:00`)
    const timeSlots = []

    while (startTime < endTime) {
      const slotEnd = new Date(startTime.getTime() + 60 * 60 * 1000) // 1 hour later
      const start = startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      const end = slotEnd.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })

      // Check if the slot is booked
      const existingBooking = await query(
        "SELECT * FROM bookings WHERE court_id = ? AND booking_date = ? AND start_time = ?",
        [courtId, date, start],
      )

      timeSlots.push({
        start,
        end,
        isBooked: existingBooking.length > 0,
      })

      startTime.setTime(slotEnd.getTime())
    }

    res.status(200).json(timeSlots)
  } catch (error) {
    console.error("Error generating time slots:", error)
    res.status(500).json({ message: "Failed to generate time slots", error: error.message })
  }
})

// Book a futsal court
app.post("/api/book", verifyToken, async (req, res) => {
  const { courtId, date, startTime, endTime } = req.body

  try {
    // Check if the time slot is available
    const existingBooking = await query(
      "SELECT * FROM bookings WHERE court_id = ? AND booking_date = ? AND start_time = ?",
      [courtId, date, startTime],
    )

    if (existingBooking.length > 0) {
      return res.status(400).json({ message: "This time slot is already booked" })
    }

    // Create the booking
    await query(
      "INSERT INTO bookings (user_id, court_id, booking_date, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [req.userId, courtId, date, startTime, endTime]
  );

    res.status(201).json({ message: "Booking successful" })
  } catch (error) {
    console.error("Error booking futsal court:", error)
    res.status(500).json({ message: "Failed to book futsal court", error: error.message })
  }
})

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

