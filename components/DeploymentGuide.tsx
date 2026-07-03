
import React from 'react';
import { Terminal, Server, Shield, Globe, Code, CheckCircle, Copy, ExternalLink, Info } from 'lucide-react';

const DeploymentGuide: React.FC = () => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const CodeBlock = ({ code, title }: { code: string; title?: string }) => (
    <div className="bg-black/60 rounded-lg border border-zinc-800 overflow-hidden my-4 font-mono text-sm">
      {title && <div className="bg-zinc-800/50 px-4 py-2 border-b border-zinc-800 text-zinc-400 text-xs flex justify-between items-center">
        <span>{title}</span>
        <button onClick={() => copyToClipboard(code)} className="hover:text-white transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>}
      <pre className="p-4 overflow-x-auto text-emerald-500/90 whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/20 rounded-xl">
            <Server className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">VPS Deployment Guide</h2>
            <p className="text-zinc-400">Transform your Linux instance into a professional RTMP broadcast hub.</p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step 1: Server Prep */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">1</div>
            <h3 className="font-bold text-lg">Server Prep</h3>
          </div>
          <p className="text-sm text-zinc-400">First, update your Ubuntu/Debian system and install basic dependencies.</p>
          <CodeBlock 
            title="Terminal"
            code="sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential libpcre3 libpcre3-dev libssl-dev zlib1g-dev"
          />
          <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            Recommended: Use Ubuntu 22.04 LTS or newer.
          </div>
        </div>

        {/* Step 2: NGINX RTMP */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold">2</div>
            <h3 className="font-bold text-lg">Install NGINX RTMP</h3>
          </div>
          <p className="text-sm text-zinc-400">Install NGINX with the RTMP module to handle the incoming video streams.</p>
          <CodeBlock 
            title="Terminal"
            code="sudo apt install -y libnginx-mod-rtmp nginx"
          />
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase">Configuration</p>
            <p className="text-xs text-zinc-400">Add this to the bottom of <code className="text-emerald-400">/etc/nginx/nginx.conf</code>:</p>
            <CodeBlock 
              code={`rtmp {
    server {
        listen 1935;
        chunk_size 4096;
        application live {
            live on;
            record off;
        }
    }
}`}
            />
          </div>
        </div>

        {/* Step 3: Firewall & Deploy */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold">3</div>
            <h3 className="font-bold text-lg">Network & Launch</h3>
          </div>
          <p className="text-sm text-zinc-400">Open necessary ports and deploy this dashboard to your public web folder.</p>
          <CodeBlock 
            title="Firewall"
            code="sudo ufw allow 1935/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp"
          />
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-1" />
              <div>
                <p className="text-xs font-bold">Restart NGINX</p>
                <p className="text-[10px] text-zinc-500">sudo systemctl restart nginx</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
              <Globe className="w-4 h-4 text-blue-500 mt-1" />
              <div>
                <p className="text-xs font-bold">Upload Dashboard</p>
                <p className="text-[10px] text-zinc-500">Move your build files to /var/www/html/</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-3xl p-8">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="space-y-4 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-[10px] font-bold text-blue-400 uppercase tracking-widest">
              Advanced Setup
            </div>
            <h3 className="text-2xl font-bold">Automated Setup with rsync</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              If you want to "upload" your local project to the VPS quickly, use the following command from your local machine terminal:
            </p>
            <CodeBlock 
              code="rsync -avz --exclude 'node_modules' . root@YOUR_VPS_IP:/var/www/streampulse"
            />
          </div>
          <div className="shrink-0">
            <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center text-center space-y-4">
                <Terminal className="w-12 h-12 text-blue-500" />
                <div>
                  <p className="font-bold text-lg">Next Steps</p>
                  <p className="text-xs text-zinc-500">Configure SSL with Certbot for HTTPS access.</p>
                </div>
                <a 
                  href="https://certbot.eff.org/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                >
                  Go to Certbot <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DeploymentGuide;
