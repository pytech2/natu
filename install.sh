#!/bin/bash

#====================================================================
# NSTU India Property Tax App - Installation Script
# For Hostinger VPS (Ubuntu 22.04/24.04)
# Domain: app.nstuindia.com
#====================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     NSTU INDIA PRIVATE LIMITED - App Installation          ║"
echo "║     Property Tax Notice Distribution System                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
DOMAIN="app.nstuindia.com"
APP_DIR="/var/www/nstu-app"
MONGO_DB="nstu_property_tax"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/8] Updating system...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}[2/8] Installing dependencies...${NC}"
apt install -y curl wget git nginx certbot python3-certbot-nginx python3 python3-pip python3-venv nodejs npm

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install yarn
npm install -g yarn

echo -e "${YELLOW}[3/8] Installing MongoDB...${NC}"
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

echo -e "${YELLOW}[4/8] Creating app directory...${NC}"
mkdir -p $APP_DIR
cd $APP_DIR

# If app files don't exist, show instructions
if [ ! -f "backend/server.py" ]; then
    echo -e "${YELLOW}Please upload your app files to $APP_DIR${NC}"
    echo "Expected structure:"
    echo "  $APP_DIR/backend/"
    echo "  $APP_DIR/frontend/"
    echo ""
    echo "You can use SCP or SFTP to upload files."
    exit 1
fi

echo -e "${YELLOW}[5/8] Setting up Backend...${NC}"
cd $APP_DIR/backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create backend .env if not exists
if [ ! -f ".env" ]; then
    cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=$MONGO_DB
JWT_SECRET=$(openssl rand -hex 32)
EOF
fi

deactivate

echo -e "${YELLOW}[6/8] Setting up Frontend...${NC}"
cd $APP_DIR/frontend

# Create frontend .env
cat > .env << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
EOF

# Install and build frontend
yarn install
yarn build

echo -e "${YELLOW}[7/8] Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/nstu-app << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend (React build)
    location / {
        root $APP_DIR/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }

    # Uploaded files
    location /api/uploads {
        alias $APP_DIR/backend/uploads;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nstu-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo -e "${YELLOW}[8/8] Creating systemd service...${NC}"
cat > /etc/systemd/system/nstu-backend.service << EOF
[Unit]
Description=NSTU Property Tax Backend
After=network.target mongod.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR/backend
Environment=PATH=$APP_DIR/backend/venv/bin
ExecStart=$APP_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Start services
systemctl daemon-reload
systemctl enable nstu-backend
systemctl start nstu-backend

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                 Installation Complete!                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Point your domain $DOMAIN to this server's IP"
echo "2. Run SSL setup: sudo certbot --nginx -d $DOMAIN"
echo "3. Create admin user by visiting: http://$DOMAIN"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  Check backend status:  sudo systemctl status nstu-backend"
echo "  View backend logs:     sudo journalctl -u nstu-backend -f"
echo "  Restart backend:       sudo systemctl restart nstu-backend"
echo "  Restart nginx:         sudo systemctl restart nginx"
echo ""
echo -e "${GREEN}Default Admin: admin / nastu123${NC}"
echo ""
