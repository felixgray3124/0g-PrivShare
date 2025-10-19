# PrivShare – Decentralized Privacy File Sharing

PrivShare is a **Web3 file sharing platform** built on **0G's modular infrastructure**.  
It leverages **0G Storage** to provide secure file sharing with **privacy, verifiability, and decentralized storage**.

PrivShare combines the power of decentralized storage with **end-to-end encryption** to create a privacy-first file sharing experience — featuring **secure file upload**, **encrypted storage**, **share code generation**, and **verifiable downloads**.

---

## 🚩 Problem

### Centralized Storage Risks
Current file-sharing services are **centralized and vulnerable**:
- **File storage** is vulnerable to censorship and data breaches
- **No end-to-end encryption** for user files
- **Data ownership** is unclear when using centralized services
- **No decentralized alternatives** for secure file sharing

### Privacy & Security Issues
- **Files are stored** on centralized servers without encryption
- **No privacy protection** for sensitive documents
- **Data breaches** expose user files to unauthorized access
- **No user control** over their own data

### Limited Web3 Integration
- **No blockchain-native** file sharing solutions
- **Missing decentralized storage** for Web3 applications
- **No token-based** access control or monetization
- **Limited interoperability** with other Web3 applications

👉 **The gap: We need file sharing that is decentralized, private, secure, and Web3-native.**

---

## ✅ Solution

PrivShare leverages **0G's modular infrastructure** to deliver **decentralized file sharing**:

### 🔒 Privacy & Security
- **End-to-end encryption** with **0G Storage**  
  Files are encrypted before storage, only accessible with proper decryption keys

- **Decentralized file storage**  
  Files are stored on the 0G Storage network, not centralized servers

- **Zero-knowledge file sharing**  
  Share files without revealing content to the platform

### ⛓️ Web3 Integration
- **0G Storage** for decentralized file storage
- **IPFS** for metadata storage and content addressing
- **Wallet integration** for user authentication

### 🚀 Advanced Features
- **Secure file upload** with automatic encryption
- **Share code generation** for easy file sharing
- **File preview** and metadata display
- **Encrypted and non-encrypted** file support

👉 **PrivShare = Privacy + Decentralization + Web3 Native**

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern web application framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library

### Web3 Integration
- **Wagmi v2** - React hooks for EVM
- **RainbowKit** - Wallet connection UI
- **Ethers.js v6** - EVM library
- **Viem** - TypeScript interface for EVM

### 0G Integration
- **0G Storage SDK** - Decentralized file storage
- **0G Chain** - EVM-compatible blockchain

### Backend & Storage
- **0G Storage** - Decentralized file storage (content and metadata via share code)

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Node.js polyfills** - Browser compatibility

---

## 📁 Project Structure

```
privshare/
├── src/
│   ├── components/          # React components
│   │   ├── FileUpload.tsx   # File upload interface
│   │   ├── FileDownload.tsx # File download interface
│   │   ├── ShareCodeDisplay.tsx # Share code display
│   │   └── WalletConnect.tsx # Wallet connection
│   ├── hooks/               # React hooks
│   │   ├── useFileUpload.ts # File upload logic
│   │   ├── useFileDownload.ts # File download logic
│   │   ├── useFilePreview.ts # File preview logic
│   │   └── useEthers.ts     # EVM integration
│   ├── lib/                 # Core libraries
│   │   ├── 0g-storage.ts    # 0G Storage integration
│   │   ├── encryption.ts    # File encryption/decryption
│   │   ├── ipfs-mapping.ts  # IPFS metadata management
│   │   ├── wagmi.ts         # Wagmi configuration
│   │   └── utils.ts         # Utility functions
│   ├── providers/           # React context providers
│   │   └── ZgStorageProvider.tsx # 0G Storage provider
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # Type definitions
│   ├── App.tsx              # Main application component
│   └── main.tsx             # Application entry point
├── public/                  # Static assets
├── dist/                    # Build output
├── package.json             # Dependencies and scripts
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── readme.md                # Project documentation
```

---

## 🚀 Local Development

### Prerequisites

- **Node.js** (v18 or higher)
- **pnpm** (recommended) or npm
- **EVM wallet** (MetaMask, Rainbow, etc.)

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# WalletConnect Configuration
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# 0G Storage Configuration (optional overrides; defaults are hardcoded)
VITE_0G_RPC_URL=https://evmrpc-testnet.0g.ai/
VITE_0G_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/felixgray3124/0g-PrivShare.git
   cd 0g-privshare
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Start development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Build for Production

```bash
# Install dependencies
pnpm install

# Build the application
pnpm build

# Preview the build
pnpm preview
```

---

## 🔧 Configuration


### WalletConnect Setup

1. **Create WalletConnect project** at [cloud.walletconnect.com](https://cloud.walletconnect.com)
2. **Get Project ID**
3. **Add Project ID** to `.env.local`

### 0G Storage Setup

1. **Get 0G testnet access** from [0g.ai](https://0g.ai)
2. **Configure RPC URLs** in `.env.local`
3. **Connect wallet** to 0G testnet

---

## 📖 Usage

### Upload Files

1. **Connect your wallet** to the 0G testnet
2. **Select a file** to upload
3. **Choose encryption** (optional)
4. **Upload** to 0G Storage
5. **Get share code** for sharing

### Download Files

1. **Enter share code** in the download section
2. **Provide decryption key** (if encrypted)
3. **Download** the file securely

### Features

- **End-to-end encryption** for sensitive files
- **Non-encrypted** files for public sharing
- **File preview** before download
- **Metadata display** (file size, type, etc.)
- **Share code generation** for easy sharing

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---