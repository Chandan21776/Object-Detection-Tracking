class ObjectTracker {
    constructor() {
        this.nextId = 0;
        this.tracks = new Map();
        this.maxAge = 30;
        this.distanceThreshold = 100;
        this.lastTime = 0;
        this.fps = 0;
    }

    distance(a, b) {
        const cx1 = a.x + a.width / 2;
        const cy1 = a.y + a.height / 2;
        const cx2 = b.x + b.width / 2;
        const cy2 = b.y + b.height / 2;
        return Math.hypot(cx1 - cx2, cy1 - cy2);
    }

    update(detections) {
        const updated = new Map();

        for (let det of detections) {
            let matched = false;

            for (let [id, tr] of this.tracks) {
                if (this.distance(tr.box, det.box) < this.distanceThreshold) {
                    tr.box = det.box;
                    tr.label = det.label;
                    tr.score = det.score;
                    tr.age = 0;
                    updated.set(id, tr);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                updated.set(this.nextId, {
                    id: this.nextId,
                    box: det.box,
                    label: det.label,
                    score: det.score,
                    age: 0
                });
                this.nextId++;
            }
        }

        for (let [id, tr] of this.tracks) {
            tr.age++;
            if (tr.age < this.maxAge && !updated.has(id)) {
                updated.set(id, tr);
            }
        }

        this.tracks = updated;
        return [...updated.values()];
    }
}

class DetectionApp {
    constructor() {
        this.video = document.getElementById("video");
        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.model = null;
        this.tracker = new ObjectTracker();
        this.running = false;
        this.confidence = 0.5;

        this.canvas.width = 640;
        this.canvas.height = 480;

        document.getElementById("startBtn").onclick = () => this.start();
        document.getElementById("stopBtn").onclick = () => this.stop();
        document.getElementById("confidence").onchange = e =>
            this.confidence = parseFloat(e.target.value);
    }

    async start() {
        this.model = await cocoSsd.load();
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.video.srcObject = stream;
        this.running = true;
        document.getElementById("startBtn").disabled = true;
        document.getElementById("stopBtn").disabled = false;
        this.detect();
    }

    stop() {
        this.running = false;
        this.video.srcObject.getTracks().forEach(t => t.stop());
        document.getElementById("startBtn").disabled = false;
        document.getElementById("stopBtn").disabled = true;
        this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    }

    async detect() {
        if (!this.running) return;

        const now = performance.now();
        this.tracker.fps = Math.round(1000 / (now - this.tracker.lastTime));
        this.tracker.lastTime = now;

        const preds = await this.model.detect(this.video);
        const detections = preds
            .filter(p => p.score >= this.confidence)
            .map(p => ({
                box: {
                    x: p.bbox[0],
                    y: p.bbox[1],
                    width: p.bbox[2],
                    height: p.bbox[3]
                },
                label: p.class,
                score: p.score
            }));

        const tracks = this.tracker.update(detections);
        this.draw(tracks);
        this.updateStats();

        requestAnimationFrame(() => this.detect());
    }

    draw(tracks) {
        this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        tracks.forEach(t => {
            this.ctx.strokeStyle = "lime";
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(t.box.x, t.box.y, t.box.width, t.box.height);
            this.ctx.fillStyle = "lime";
            this.ctx.fillText(
                `ID:${t.id} ${t.label}`,
                t.box.x,
                t.box.y - 5
            );
        });
    }

    updateStats() {
        document.getElementById("fps").innerText = `FPS: ${this.tracker.fps}`;
        document.getElementById("objectCount").innerText = this.tracker.tracks.size;

        const list = document.getElementById("trackList");
        list.innerHTML = "";
        this.tracker.tracks.forEach(t => {
            const d = document.createElement("div");
            d.className = "track";
            d.innerText = `ID:${t.id} ${t.label} (${Math.round(t.score*100)}%)`;
            list.appendChild(d);
        });
    }
}

new DetectionApp();
