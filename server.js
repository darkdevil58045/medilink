require('dotenv').config();
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { User, MedicalRecord, Alert } = require('./models');
const { generateMfaSecret, generateMfaQrCode, verifyMfaToken } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medilink', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role, email, fullName, language } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash, role, email, fullName, language });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Setup MFA for user
app.post('/api/mfa/setup', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const secret = generateMfaSecret();
    user.mfaSecret = secret.base32;
    await user.save();
    const qrCodeDataUrl = await generateMfaQrCode(secret, user.email);
    res.json({ qrCodeDataUrl, secret: secret.base32 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to setup MFA' });
  }
});

// Verify MFA token
app.post('/api/mfa/verify', async (req, res) => {
  try {
    const { userId, token } = req.body;
    const user = await User.findById(userId);
    if (!user || !user.mfaSecret) {
      return res.status(404).json({ error: 'User or MFA secret not found' });
    }
    const verified = verifyMfaToken({ base32: user.mfaSecret }, token);
    if (verified) {
      res.json({ message: 'MFA verified' });
    } else {
      res.status(400).json({ error: 'Invalid MFA token' });
    }
  } catch (err) {
    res.status(500).json({ error: 'MFA verification failed' });
  }
});

// User login with MFA check
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, mfaToken } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
    if (user.mfaSecret) {
      if (!mfaToken) {
        return res.status(400).json({ error: 'MFA token required' });
      }
      const verified = verifyMfaToken({ base32: user.mfaSecret }, mfaToken);
      if (!verified) {
        return res.status(400).json({ error: 'Invalid MFA token' });
      }
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET || 'secretkey', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Upload medical record
app.post('/api/medical-records', authenticateToken, async (req, res) => {
  try {
    const { recordType, dataUrl, classification } = req.body;
    const medicalRecord = new MedicalRecord({
      patient: req.user.userId,
      recordType,
      dataUrl,
      classification: classification || 'Non-Critical'
    });
    await medicalRecord.save();
    res.status(201).json({ message: 'Medical record uploaded' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload medical record' });
  }
});

// Get alerts for provider
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const alerts = await Alert.find({ provider: req.user.userId, isRead: false }).populate('patient', 'fullName');
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GraphQL schema and root resolver placeholder
const schema = buildSchema(`
  type Query {
    hello: String
  }
`);

const root = {
  hello: () => {
    return 'Hello from MediLink GraphQL API';
  },
};

app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Listen for provider joining their room for alerts
  socket.on('joinProviderRoom', (providerId) => {
    socket.join(providerId);
    console.log(`Provider ${providerId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Function to emit alert to provider room
function emitAlertToProvider(providerId, alert) {
  io.to(providerId).emit('newAlert', alert);
}

// Modify medical record upload to emit alert if classification is Critical
app.post('/api/medical-records', authenticateToken, async (req, res) => {
  try {
    const { recordType, dataUrl, classification } = req.body;
    const medicalRecord = new MedicalRecord({
      patient: req.user.userId,
      recordType,
      dataUrl,
      classification: classification || 'Non-Critical'
    });
    await medicalRecord.save();

    // If classification is Critical, create alert and emit
    if (classification === 'Critical') {
      // Find providers to alert - for simplicity, alert all providers
      const providers = await User.find({ role: 'provider' });
      for (const provider of providers) {
        const alert = new Alert({
          provider: provider._id,
          patient: req.user.userId,
          message: 'Critical patient case detected',
          isRead: false
        });
        await alert.save();
        emitAlertToProvider(provider._id.toString(), alert);
      }
    }

    res.status(201).json({ message: 'Medical record uploaded' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload medical record' });
  }
});

const PORT = process.env.PORT || 4000;
const path = require('path');
const { generatePatientReport } = require('./pdfGenerator');

app.get('/api/patient-report/:patientId', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.patientId;
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    // For demo, AI assessment is a placeholder string
    const aiAssessment = 'Patient condition classified as Moderate. No immediate critical issues detected.';
    const outputPath = path.join(__dirname, `reports/patient_report_${patientId}.pdf`);

    // Generate PDF report
    await generatePatientReport(patient, aiAssessment, outputPath);

    res.download(outputPath, `patient_report_${patientId}.pdf`, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
        res.status(500).send('Error sending PDF');
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate patient report' });
  }
});

server.listen(PORT, () => {
  console.log(`MediLink backend server running on port ${PORT}`);
});
