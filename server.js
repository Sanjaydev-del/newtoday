const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for inline scripts/styles freedom in this demo
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data Directory
// On Vercel, we must use /tmp for writing. In local dev, we use ./data
const DATA_DIR = process.env.NODE_ENV === 'production' || process.env.VERCEL
    ? path.join('/tmp', 'data')
    : path.join(__dirname, 'data');

const FILES = {
    bookings: path.join(DATA_DIR, 'bookings.json'),
    contacts: path.join(DATA_DIR, 'contacts.json'),
    subscribers: path.join(DATA_DIR, 'subscribers.json')
};

// Pricing Configuration
const ROOM_PRICES = {
    'rooms': 120,
    'suites': 210,
    'lux': 280,
    'prestige': 320
};

const ROOM_COUNTS = {
    'rooms': 48,
    'suites': 29,
    'lux': 15,
    'prestige': 6
};

// Initialize Data Files
async function initData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        for (const file of Object.values(FILES)) {
            try {
                // In /tmp, files disappear on restart, so we must recreate them if missing
                await fs.access(file);
            } catch {
                await fs.writeFile(file, '[]');
                console.log(`Created ${path.basename(file)} in ${DATA_DIR}`);
            }
        }
    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

initData();

// Helper: Read JSON
async function readJson(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If read fails (e.g. file deleted by ephemeral FS), try re-init or return empty
        return [];
    }
}

// Helper: Write JSON
async function writeJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Helper: Send Email (Mock or Real)
async function sendEmail({ to, subject, html }) {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        await transporter.sendMail({ from: '"Kaskady Hotel" <no-reply@hotelkaskady.sk>', to, subject, html });
    } else {
        console.log(`\n📧 [EMAIL MOCK] To: ${to} | Subject: ${subject}`);
    }
}

// Routes
app.get('/health', (req, res) => {
    res.json({ success: true, message: "Server is running", timestamp: new Date() });
});

// POST /api/contact
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
        }

        const contacts = await readJson(FILES.contacts);
        const newContact = {
            id: Date.now().toString(),
            name, email, phone, message,
            submittedAt: new Date().toISOString()
        };
        contacts.push(newContact);
        await writeJson(FILES.contacts, contacts);

        await sendEmail({
            to: email,
            subject: 'Thank you for contacting Kaskady',
            html: `<h1>Thank you, ${name}</h1><p>We have received your message and will get back to you shortly.</p>`
        });

        res.json({ success: true, message: 'Message sent successfully.', data: { id: newContact.id } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/booking
app.post('/api/booking', async (req, res) => {
    try {
        const { roomType, checkIn, checkOut, guests, name, email, phone, specialRequests } = req.body;

        if (!roomType || !checkIn || !checkOut || !name || !email) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }
        if (!ROOM_PRICES[roomType]) {
            return res.status(400).json({ success: false, message: 'Invalid room type.' });
        }

        const start = new Date(checkIn);
        const end = new Date(checkOut);
        if (start >= end) {
            return res.status(400).json({ success: false, message: 'Check-out must be after check-in.' });
        }

        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const totalPrice = nights * ROOM_PRICES[roomType];

        const bookings = await readJson(FILES.bookings);
        const bookingReference = 'BK-' + Date.now().toString(36).toUpperCase();

        const newBooking = {
            reference: bookingReference,
            roomType, checkIn, checkOut, guests, name, email, phone, specialRequests,
            nights, totalPrice,
            bookedAt: new Date().toISOString()
        };

        bookings.push(newBooking);
        await writeJson(FILES.bookings, bookings);

        await sendEmail({
            to: email,
            subject: `Booking Confirmation: ${bookingReference}`,
            html: `<h1>Booking Confirmed</h1>
                   <p>Reference: <strong>${bookingReference}</strong></p>
                   <p>Room: ${roomType.toUpperCase()}</p>
                   <p>Nights: ${nights}</p>
                   <p>Total Price: <span style="color:#d4af37">€${totalPrice}</span></p>`
        });

        res.json({ success: true, message: 'Booking confirmed.', data: newBooking });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/availability
app.get('/api/availability', async (req, res) => {
    try {
        const { checkIn, checkOut } = req.query;
        if (!checkIn || !checkOut) {
            return res.status(400).json({ success: false, message: 'Check-in and check-out dates required.' });
        }

        const reqStart = new Date(checkIn);
        const reqEnd = new Date(checkOut);
        const bookings = await readJson(FILES.bookings);

        const bookedCounts = { 'rooms': 0, 'suites': 0, 'lux': 0, 'prestige': 0 };

        bookings.forEach(b => {
            const bStart = new Date(b.checkIn);
            const bEnd = new Date(b.checkOut);

            // Check overlap
            if (reqStart < bEnd && reqEnd > bStart) {
                if (bookedCounts[b.roomType] !== undefined) {
                    bookedCounts[b.roomType]++;
                }
            }
        });

        const availability = {};
        for (const [type, total] of Object.entries(ROOM_COUNTS)) {
            availability[type] = Math.max(0, total - bookedCounts[type]);
        }

        res.json({ success: true, data: { availability } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/newsletter
app.post('/api/newsletter', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email required.' });

        const subscribers = await readJson(FILES.subscribers);
        if (!subscribers.includes(email)) {
            subscribers.push(email);
            await writeJson(FILES.subscribers, subscribers);
            await sendEmail({
                to: email,
                subject: 'Welcome to Kaskady',
                html: '<h1>Welcome!</h1><p>You have been subscribed to our newsletter.</p>'
            });
        }

        res.json({ success: true, message: 'Successfully subscribed!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/booking/:reference
app.get('/api/booking/:reference', async (req, res) => {
    try {
        const { reference } = req.params;
        const bookings = await readJson(FILES.bookings);
        const booking = bookings.find(b => b.reference === reference);

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║         🏨  KASKADY LUXURY HOTEL SERVER  🏨          ║
║                                                       ║
║  Status:  Running ✓                                   ║
║  Port:    ${PORT}                                        ║
║  Storage: JSON Files (./data/)                        ║
║  URL:     http://localhost:${PORT}                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});
