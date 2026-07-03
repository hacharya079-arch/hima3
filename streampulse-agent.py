#!/usr/bin/env python3
"""
StreamPulse Raspberry Pi Native Streaming Agent
Controls local MPV Native player and monitors hardware telemetries.
No browser required. Runs fullscreen via HDMI.
"""

import os
import sys
import time
import json
import socket
import psutil
import urllib.request
import subprocess
import threading
import asyncio

# Attempt to import websockets, print helpful tip if missing
try:
    import websockets
except ImportError:
    print("Missing 'websockets' library. Please run: pip3 install websockets psutil")
    sys.exit(1)

CONFIG_FILE = os.path.expanduser('~/.streampulse_config.json')
CORE_SERVER = "http://localhost:3000" # Should be modified to point to your live StreamPulse domain / VPS IP
WS_SERVER = "ws://localhost:3000/api/device-ws" # WS endpoint

device_state = {
    "paired": False,
    "token": "",
    "device_id": "",
    "current_process": None,
    "current_stream_url": ""
}

player_config = {
    "hwdec": "auto",
    "cache_size": 32,
    "audio_driver": "alsa"
}

def load_config():
    global device_state, player_config
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                saved = json.load(f)
                device_state.update(saved.get("state", {}))
                player_config.update(saved.get("player", {}))
        except Exception as e:
            print(f"Error loading config: {e}")

def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({
                "state": {
                    "paired": device_state["paired"],
                    "token": device_state["token"],
                    "device_id": device_state["device_id"]
                },
                "player": player_config
            }, f)
    except Exception as e:
        print(f"Error saving config: {e}")

def get_mac_address():
    try:
        import uuid
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> ele) & 0xff) for ele in range(0,8*6,8)][::-1])
        return mac
    except:
        return "00:11:22:33:44:55"

def get_ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def get_cpu_temp():
    try:
        # Raspberry Pi specific temperature file
        if os.path.exists('/sys/class/thermal/thermal_zone0/temp'):
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                temp = float(f.read()) / 1000.0
                return round(temp, 1)
        return 42.0
    except:
        return 42.0

def play_stream(url):
    stop_stream()
    print(f"Playing stream: {url}")
    try:
        # Construct hardware accelerated MPV command optimized for Pi 3, 4, and 5
        cmd = [
            "mpv",
            "--fs",
            "--ontop",
            "--no-osc",
            "--no-osd-bar",
            f"--hwdec={player_config['hwdec']}",
            f"--demuxer-max-bytes={player_config['cache_size'] * 1024 * 1024}",
            f"--ao={player_config['audio_driver']}",
            "--cache=yes",
            "--cache-secs=5",
            url
        ]
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        device_state["current_process"] = process
        device_state["current_stream_url"] = url
        return True
    except Exception as e:
        print(f"Failed to launch MPV: {e}")
        return False

def stop_stream():
    if device_state["current_process"]:
        try:
            device_state["current_process"].terminate()
            device_state["current_process"].wait(timeout=3)
        except:
            try:
                device_state["current_process"].kill()
            except:
                pass
        device_state["current_process"] = None
        device_state["current_stream_url"] = ""

async def register_device():
    mac = get_mac_address()
    ip = get_ip_address()
    hostname = socket.gethostname()
    
    payload = {
        "deviceId": device_state["device_id"],
        "name": f"StreamPulse Pi Receiver ({hostname})",
        "mac_address": mac,
        "os_version": "Raspberry Pi OS (Bookworm)",
        "player_version": "MPV Native Client",
        "ip_address": ip
    }
    
    while not device_state["paired"]:
        try:
            req = urllib.request.Request(
                f"{CORE_SERVER}/api/devices/register",
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req) as response:
                res = json.loads(response.read().decode())
                device_state["device_id"] = res["deviceId"]
                if res.get("paired"):
                    device_state["paired"] = True
                    device_state["token"] = res["token"]
                    save_config()
                    print("Device paired and registered successfully!")
                    break
                else:
                    print(f"Awaiting pair activation on Dashboard. Code: {res['pairingCode']}")
                    time.sleep(8)
        except Exception as e:
            print(f"Connecting to StreamPulse core server... ({e})")
            time.sleep(5)

async def heartbeat_sender(websocket):
    while True:
        try:
            cpu = psutil.cpu_percent()
            ram = psutil.virtual_memory().percent
            temp = get_cpu_temp()
            
            # Bandwidth speed representation
            net_io = psutil.net_io_counters()
            speed = f"{round((net_io.bytes_sent + net_io.bytes_recv) / 1024 / 1024, 2)} MB"
            
            playback_status = "idle"
            if device_state["current_process"]:
                poll = device_state["current_process"].poll()
                if poll is None:
                    playback_status = "playing"
                else:
                    playback_status = "stopped"
                    device_state["current_process"] = None

            screenshot_b64 = ""
            # Take system framebuffer screenshot if scrot is installed
            if playback_status == "playing":
                try:
                    subprocess.run(["scrot", "-z", "/tmp/screen.jpg"], capture_output=True)
                    if os.path.exists("/tmp/screen.jpg"):
                        import base64
                        with open("/tmp/screen.jpg", "rb") as image_file:
                            screenshot_b64 = "data:image/jpeg;base64," + base64.b64encode(image_file.read()).decode('utf-8')
                except:
                    pass

            payload = {
                "type": "heartbeat",
                "cpu_usage": cpu,
                "ram_usage": ram,
                "temperature": temp,
                "network_speed": speed,
                "online_status": "playing" if playback_status == "playing" else "online",
                "current_playback_status": playback_status,
                "current_stream_url": device_state["current_stream_url"]
            }
            if screenshot_b64:
                payload["screenshot"] = screenshot_b64

            await websocket.send(json.dumps(payload))
            await asyncio.sleep(10)
        except Exception as e:
            print(f"Error sending telemetry update: {e}")
            break

async def ws_loop():
    uri = f"{WS_SERVER}?token={device_state['token']}"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print("Established WebSocket connection to StreamPulse.")
                
                heartbeat_task = asyncio.create_task(heartbeat_sender(websocket))
                
                async for message in websocket:
                    data = json.loads(message)
                    print(f"Dispatched action: {data}")
                    
                    if data.get("type") == "command":
                        cmd = data.get("command")
                        args = data.get("args", {})
                        
                        if cmd == "play":
                            play_stream(args.get("streamUrl"))
                        elif cmd == "stop":
                            stop_stream()
                        elif cmd == "volume":
                            vol = args.get("volume", 100)
                            subprocess.run(["amixer", "set", "Master", f"{vol}%"], capture_output=True)
                        elif cmd == "restart_player":
                            if device_state["current_stream_url"]:
                                play_stream(device_state["current_stream_url"])
                        elif cmd == "restart_device":
                            os.system("sudo reboot")
                        elif cmd == "shutdown_device":
                            os.system("sudo poweroff")

                    elif data.get("type") == "configure":
                        cfg = data.get("config", {})
                        if "volume" in cfg and cfg["volume"] is not None:
                            vol = cfg["volume"]
                            subprocess.run(["amixer", "set", "Master", f"{vol}%"], capture_output=True)
                        if "brightness" in cfg and cfg["brightness"] is not None:
                            bri = cfg["brightness"]
                            # Update HDMI backlight/display brightness
                            os.system(f"brightnessctl set {bri}% || echo {bri} > /sys/class/backlight/rpi_backlight/brightness || xrandr --brightness {bri/100.0}")
                        if "rotation" in cfg and cfg["rotation"] is not None:
                            rot = cfg["rotation"]
                            rot_map = {"0": "normal", "90": "right", "180": "inverted", "270": "left"}
                            os.system(f"xrandr --rotate {rot_map.get(rot, 'normal')}")
                        if "resolution" in cfg and cfg["resolution"] is not None:
                            res = cfg["resolution"]
                            os.system(f"xrandr -s {res}")
                        if "network_settings" in cfg and cfg["network_settings"] is not None:
                            net = cfg["network_settings"]
                            ssid = net.get("ssid")
                            pwd = net.get("password")
                            if ssid:
                                os.system(f"nmcli dev wifi connect '{ssid}' password '{pwd}'")
                        if "player_settings" in cfg and cfg["player_settings"] is not None:
                            play = cfg["player_settings"]
                            player_config["hwdec"] = play.get("hwdec", "auto")
                            player_config["cache_size"] = play.get("cacheSize", 32)
                            player_config["audio_driver"] = play.get("audioDriver", "alsa")
                            save_config()

                    elif data.get("type") == "ota_update":
                        target_ver = data.get("version", "1.1.0")
                        update_url = data.get("url")
                        if update_url:
                            print(f"Triggered Remote OTA update to v{target_ver} from {update_url}...")
                            try:
                                urllib.request.urlretrieve(update_url, "streampulse-agent-temp.py")
                                os.replace("streampulse-agent-temp.py", __file__)
                                print("OTA Upgrade applied successfully! Re-launching daemon...")
                                os.execv(sys.executable, [sys.executable] + sys.argv)
                            except Exception as ota_err:
                                print(f"OTA update failed: {ota_err}")
                
                heartbeat_task.cancel()
        except Exception as e:
            print(f"Connection lost: {e}. Retrying connection in 5s...")
            await asyncio.sleep(5)

async def main():
    load_config()
    await register_device()
    await ws_loop()

if __name__ == "__main__":
    asyncio.run(main())
