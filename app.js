class VirtualDrawingApp {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.drawingCanvas = document.getElementById('drawing-canvas');
    this.ctx = this.drawingCanvas.getContext('2d');
    this.modeIndicator = document.getElementById('mode-indicator');
    
    this.currentColor = '#000000';
    this.brushSize = 5;
    this.eraserSize = 20;
    this.isEraser = false;
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.isRunning = false;
    this.camera = null;
    this.hands = null;
    
    this.virtualButtons = [];
    this.virtualSliders = {};
    this.activeSlider = null;
    this.isMenuOpen = false;
    
    this.currentTool = 'pen'; 
    this.startX = null;
    this.startY = null;
    this.tempCanvas = document.createElement('canvas');
    this.tempCtx = this.tempCanvas.getContext('2d');
    
    this.points = [];
    this.pointsCount = 0;

    this.drawingHistory = [];
    this.currentHistoryIndex = -1;
    this.maxHistorySteps = 50; // Maximum number of steps to store
    
    // Save initial blank state
    this.saveDrawingState();

    this.setupCanvasSize();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupVirtualControls();
    this.showPenThickness = false;
    this.showEraserThickness = false;
  }

  setupCanvasSize() {
    const updateCanvasSize = () => {
      const container = document.querySelector('.canvas-container');
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      
      [this.canvas, this.drawingCanvas].forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
  }

  setupHandTracking() {
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    this.hands.onResults((results) => this.onResults(results));

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        if (this.isRunning) {
          await this.hands.send({image: this.video});
        }
      },
      width: 1280,
      height: 720
    });
  }

  async startCamera() {
    if (!this.hands) {
      this.setupHandTracking();
    }
    this.isRunning = true;
    await this.camera.start();
    this.modeIndicator.textContent = 'Mode: Navigation';
    document.getElementById('start-camera').disabled = true;
    document.getElementById('stop-camera').disabled = false;
  }

  async stopCamera() {
    this.isRunning = false;
    if (this.camera) {
      await this.camera.stop();
    }
    this.modeIndicator.textContent = 'Mode: Camera off';
    document.getElementById('start-camera').disabled = false;
    document.getElementById('stop-camera').disabled = true;
    
    // Clear all canvases
    this.ctx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    const ctxPreview = this.canvas.getContext('2d');
    ctxPreview.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setupEventListeners() {
    document.getElementById('start-camera').addEventListener('click', () => this.startCamera());
    document.getElementById('stop-camera').addEventListener('click', () => this.stopCamera());
    document.getElementById('clear').addEventListener('click', () => {
      this.ctx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    });
  }

  setupKeyboardShortcuts() {
  }

  setupVirtualControls() {
    this.virtualButtons = [];
    this.virtualSliders = {};
  }

  drawVirtualControls(ctx) {
    if (!this.virtualButtons.length) {
      this.setupVirtualControls();
    }

    // Draw color palette first (always visible)
    this.drawColorSection(ctx, 15, 50);

    // Draw undo/redo buttons at the top
    this.drawUndoRedoButtons(ctx);

    // Draw maximize button when menu is closed
    if (!this.isMenuOpen) {
      const buttonX = 60;  // Moved right to not overlap with color palette
      const buttonY = this.drawingCanvas.height / 2;  
  
      ctx.save();
      
      ctx.beginPath();
      ctx.roundRect(buttonX, buttonY, 30, 30, [10]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;  
      ctx.fill();

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(buttonX + 8, buttonY + 15);
      ctx.lineTo(buttonX + 22, buttonY + 15);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(buttonX + 17, buttonY + 10);
      ctx.lineTo(buttonX + 22, buttonY + 15);
      ctx.lineTo(buttonX + 17, buttonY + 20);
      ctx.stroke();

      ctx.restore();
    }

    // If menu is open, draw tools
    if (this.isMenuOpen) {
      ctx.save();

      const menuX = 60;  // Moved right to not overlap with color palette
      const menuY = 10;
      const minButtonX = menuX + 40;
      const minButtonY = menuY + 50;

      // Draw minimize button
      ctx.beginPath();
      ctx.roundRect(minButtonX, minButtonY, 30, 30, [10]);
      ctx.fillStyle = 'rgba(240, 240, 240, 0.95)';
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fill();

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(minButtonX + 22, minButtonY + 15);
      ctx.lineTo(minButtonX + 8, minButtonY + 15);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(minButtonX + 13, minButtonY + 10);
      ctx.lineTo(minButtonX + 8, minButtonY + 15);
      ctx.lineTo(minButtonX + 13, minButtonY + 20);
      ctx.stroke();

      // Draw tools section vertically
      this.drawToolsSection(ctx, menuX + 15, menuY + 100);

      ctx.restore();
    }
  }

  drawColorSection(ctx, x, y) {
    const colors = [
      '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00'
    ];
    
    colors.forEach((color, i) => {
      const buttonX = 15;  // Fixed X position
      const buttonY = y + i * 40;  // Vertical spacing between colors
      ctx.beginPath();
      ctx.arc(buttonX, buttonY, 12, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(
        buttonX - 3, buttonY - 3, 0,
        buttonX, buttonY, 12
      );
      gradient.addColorStop(0, lightenColor(color, 30));
      gradient.addColorStop(0.7, color);
      gradient.addColorStop(1, darkenColor(color, 30));
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      if (color === this.currentColor) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  drawToolsSection(ctx, x, y) {
    const spacing = 45;
    let currentY = y;
    
    // Draw pen tool
    drawPenIcon(ctx, x, currentY, 30, this.currentTool === 'pen');
    if (this.currentTool === 'pen') {
      ctx.beginPath();
      ctx.arc(x + 15, currentY + 15, 20, 0, Math.PI * 2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw pen thickness button
    if (this.showPenThickness) {
      this.drawDiscreteSlider(ctx, x + 40, currentY + 15, 180, this.brushSize, 1, 20);
    } else {
      // Draw thickness toggle button
      ctx.beginPath();
      ctx.roundRect(x + 40, currentY, 30, 30, [5]);
      ctx.fillStyle = 'rgba(240, 240, 240, 0.95)';
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw thickness indicator dots
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + 55 - i * 5, currentY + 15, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    currentY += spacing;
    
    // Draw eraser tool
    drawEraserIcon(ctx, x, currentY, 30, this.currentTool === 'eraser');
    if (this.currentTool === 'eraser') {
      ctx.beginPath();
      ctx.arc(x + 15, currentY + 15, 20, 0, Math.PI * 2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw eraser thickness button
    if (this.showEraserThickness) {
      this.drawDiscreteSlider(ctx, x + 40, currentY + 15, 180, this.eraserSize, 5, 50);
    } else {
      // Draw thickness toggle button
      ctx.beginPath();
      ctx.roundRect(x + 40, currentY, 30, 30, [5]);
      ctx.fillStyle = 'rgba(240, 240, 240, 0.95)';
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw thickness indicator dots
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + 55 - i * 5, currentY + 15, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    currentY += spacing * 1.5;

    // Draw shape tools
    const shapes = [
      { name: 'line', icon: drawLineIcon },
      { name: 'rectangle', icon: drawRectIcon },
      { name: 'square', icon: drawSquareIcon },
      { name: 'triangle', icon: drawTriangleIcon },
      { name: 'circle', icon: drawCircleIcon }
    ];

    shapes.forEach((shape, index) => {
      shape.icon(ctx, x, currentY, 30, this.currentTool === shape.name);
      if (this.currentTool === shape.name) {
        ctx.beginPath();
        ctx.arc(x + 15, currentY + 15, 20, 0, Math.PI * 2);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      currentY += spacing;
    });
  }

  drawDiscreteSlider(ctx, x, y, width, value, min, max) {
    const steps = 10;
    const stepWidth = width / (steps - 1);
    
    // Draw base track
    ctx.beginPath();
    ctx.roundRect(x, y, width, 4, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fill();

    // Draw steps
    for (let i = 0; i < steps; i++) {
      const stepX = x + i * stepWidth;
      ctx.beginPath();
      ctx.arc(stepX, y + 2, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();
    }

    // Draw handle
    const normalizedValue = (value - min) / (max - min);
    const handleX = x + normalizedValue * width;
    
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    
    ctx.beginPath();
    ctx.arc(handleX, y + 2, 8, 0, Math.PI * 2);
    const handleGradient = ctx.createRadialGradient(handleX, y, 0, handleX, y + 2, 8);
    handleGradient.addColorStop(0, '#ffffff');
    handleGradient.addColorStop(1, '#f0f0f0');
    ctx.fillStyle = handleGradient;
    ctx.fill();
    
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawUndoRedoButtons(ctx) {
    // Draw undo button (which will now redo)
    ctx.save();
    ctx.translate(15, 15);
    
    // Undo button (now performs redo)
    ctx.beginPath();
    ctx.arc(12, 12, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fill();

    // Arrow pointing left (now for redo)
    ctx.beginPath();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.moveTo(16, 8);
    ctx.lineTo(8, 12);
    ctx.lineTo(16, 16);
    ctx.stroke();
    
    // Redo button (now performs undo)
    ctx.translate(30, 0);
    
    ctx.beginPath();
    ctx.arc(12, 12, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fill();

    // Arrow pointing right (now for undo)
    ctx.beginPath();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.moveTo(8, 8);
    ctx.lineTo(16, 12);
    ctx.lineTo(8, 16);
    ctx.stroke();

    ctx.restore();
  }

  handleVirtualControls(x, y) {
    if (this.isDrawing) return;

    // Check color selection (always available)
    const colors = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00'];
    for (let i = 0; i < colors.length; i++) {
      const buttonX = 15;
      const buttonY = 50 + i * 40;
      const distance = Math.sqrt(
        Math.pow(x - buttonX, 2) +
        Math.pow(y - buttonY, 2)
      );
      if (distance < 12) {
        this.currentColor = colors[i];
        return;
      }
    }

    // Check undo button (now performs redo)
    const undoButtonCenter = { x: 27, y: 27 };
    const undoDistance = Math.sqrt(
      Math.pow(x - undoButtonCenter.x, 2) +
      Math.pow(y - undoButtonCenter.y, 2)
    );
    if (undoDistance < 12) {
      this.redo();  // Changed from undo() to redo()
      return;
    }

    // Check redo button (now performs undo)
    const redoButtonCenter = { x: 57, y: 27 };
    const redoDistance = Math.sqrt(
      Math.pow(x - redoButtonCenter.x, 2) +
      Math.pow(y - redoButtonCenter.y, 2)
    );
    if (redoDistance < 12) {
      this.undo();  // Changed from redo() to undo()
      return;
    }

    // Check maximize button when menu is closed
    if (!this.isMenuOpen) {
      const maxButtonX = 60;
      const maxButtonY = this.drawingCanvas.height / 2;
      
      if (x >= maxButtonX && x <= maxButtonX + 30 &&
          y >= maxButtonY && y <= maxButtonY + 30) {
        this.isMenuOpen = true;
        this.showPenThickness = false;
        this.showEraserThickness = false;
        return;
      }
    }

    if (this.isMenuOpen) {
      const menuX = 60;
      const menuY = 10;
      const minButtonX = menuX + 40;
      const minButtonY = menuY + 50;
      
      // Check minimize button
      if (x >= minButtonX && x <= minButtonX + 30 &&
          y >= minButtonY && y <= minButtonY + 30) {
        this.isMenuOpen = false;
        this.showPenThickness = false;
        this.showEraserThickness = false;
        return;
      }

      // Handle color selection
      if (y >= menuY + 15 && y <= menuY + 45) {
        const colorIndex = Math.floor((x - (menuX + 15)) / 40);
        if (colorIndex >= 0 && colorIndex < 5) {
          const colors = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00'];
          this.currentColor = colors[colorIndex];
        }
      }
      
      const spacing = 45;
      let currentY = menuY + 100;

      // Check pen tool and thickness toggle
      if (y >= currentY && y <= currentY + 30) {
        if (x >= menuX + 15 && x <= menuX + 45) {
          this.currentTool = 'pen';
          this.ctx.globalCompositeOperation = 'source-over';
          this.ctx.lineWidth = this.brushSize;
        } else if (x >= menuX + 55 && x <= menuX + 85) {
          this.showPenThickness = !this.showPenThickness;
          this.showEraserThickness = false;
        }
      }
      currentY += spacing;

      // Check eraser tool and thickness toggle
      if (y >= currentY && y <= currentY + 30) {
        if (x >= menuX + 15 && x <= menuX + 45) {
          this.currentTool = 'eraser';
          this.ctx.globalCompositeOperation = 'destination-out';
          this.ctx.lineWidth = this.eraserSize;
        } else if (x >= menuX + 55 && x <= menuX + 85) {
          this.showEraserThickness = !this.showEraserThickness;
          this.showPenThickness = false;
        }
      }
      currentY += spacing * 1.5;

      // Handle thickness sliders
      if (this.showPenThickness && y >= menuY + 105 && y <= menuY + 125 && 
          x >= menuX + 55 && x <= menuX + 235) {
        const sliderPos = (x - (menuX + 55)) / 180;
        const steps = 10;
        const stepValue = Math.round(sliderPos * (steps - 1)) / (steps - 1);
        this.brushSize = Math.round(stepValue * (20 - 1) + 1);
        if (this.currentTool === 'pen') {  
          this.ctx.lineWidth = this.brushSize;
        }
      }
      
      if (this.showEraserThickness && y >= menuY + 150 && y <= menuY + 170 && 
          x >= menuX + 55 && x <= menuX + 235) {
        const sliderPos = (x - (menuX + 55)) / 180;
        const steps = 10;
        const stepValue = Math.round(sliderPos * (steps - 1)) / (steps - 1);
        this.eraserSize = Math.round(stepValue * (50 - 5) + 5);
        if (this.currentTool === 'eraser') {  
          this.ctx.lineWidth = this.eraserSize;
        }
      }

      // Check shape tools
      const shapes = ['line', 'rectangle', 'square', 'triangle', 'circle'];
      shapes.forEach((shape, index) => {
        if (y >= currentY && y <= currentY + 30 && 
            x >= menuX + 15 && x <= menuX + 45) {
          this.currentTool = shape;
          this.ctx.globalCompositeOperation = 'source-over';
        }
        currentY += spacing;
      });
    }
  }

  isPointInButton(x, y, button) {
    const distance = Math.sqrt(
      Math.pow(x - (button.x + button.width/2), 2) +
      Math.pow(y - (button.y + button.height/2), 2)
    );
    return distance < button.width/2;
  }

  isPointInSlider(x, y, slider) {
    return x >= slider.x &&
           x <= slider.x + slider.width &&
           y >= slider.y - 10 &&
           y <= slider.y + slider.height + 10;
  }

  isThumbUp(landmarks) {
    const thumb_tip = landmarks[4];
    const thumb_ip = landmarks[3];
    const thumb_mcp = landmarks[2];

    // Get tips and MCP joints of all other fingers
    const index_tip = landmarks[8];
    const middle_tip = landmarks[12];
    const ring_tip = landmarks[16];
    const pinky_tip = landmarks[20];

    const index_mcp = landmarks[5];
    const middle_mcp = landmarks[9];
    const ring_mcp = landmarks[13];
    const pinky_mcp = landmarks[17];

    // Calculate hand size for normalization
    const handSize = Math.sqrt(
      Math.pow(landmarks[17].x - landmarks[5].x, 2) +
      Math.pow(landmarks[17].y - landmarks[5].y, 2)
    );

    // Calculate minimum distance between thumb points and all other finger points
    const allFingerPoints = [
      landmarks[5], landmarks[6], landmarks[7], landmarks[8],  // index
      landmarks[9], landmarks[10], landmarks[11], landmarks[12],  // middle
      landmarks[13], landmarks[14], landmarks[15], landmarks[16],  // ring
      landmarks[17], landmarks[18], landmarks[19], landmarks[20]  // pinky
    ];

    const thumbPoints = [thumb_tip, thumb_ip, thumb_mcp];
  
    let minDistance = Infinity;
    for (const thumbPoint of thumbPoints) {
      for (const fingerPoint of allFingerPoints) {
        const distance = Math.sqrt(
          Math.pow(thumbPoint.x - fingerPoint.x, 2) +
          Math.pow(thumbPoint.y - fingerPoint.y, 2)
        ) / handSize;
        minDistance = Math.min(minDistance, distance);
      }
    }

    // Calculate thumb extension
    const thumbExtension = Math.sqrt(
      Math.pow(thumb_tip.x - thumb_mcp.x, 2) +
      Math.pow(thumb_tip.y - thumb_mcp.y, 2)
    ) / handSize;

    // Calculate angle of thumb relative to palm
    const palm_center = {
      x: (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3,
      y: (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3
    };

    const thumbVector = {
      x: thumb_tip.x - palm_center.x,
      y: thumb_tip.y - palm_center.y
    };

    // Thresholds for detection
    const THUMB_SEPARATION_THRESHOLD = 0.4;  
    const THUMB_EXTENSION_THRESHOLD = 0.5;    

    // Check all conditions
    const isThumbSeparated = minDistance > THUMB_SEPARATION_THRESHOLD;
    const isThumbExtended = thumbExtension > THUMB_EXTENSION_THRESHOLD;

    // Debug logging 
    /*
    if (Math.random() < 0.01) {
      console.log('Thumb Analysis:', {
        minDistance,
        thumbExtension,
        isThumbSeparated,
        isThumbExtended,
        THUMB_SEPARATION_THRESHOLD,
        THUMB_EXTENSION_THRESHOLD
      });
    }
    */

    // Return true only if thumb is both extended and separated
    return isThumbExtended && isThumbSeparated;
  }

  getDistance(p1, p2) {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + 
      Math.pow(p1.y - p2.y, 2) + 
      Math.pow(p1.z - p2.z, 2)
    );
  }

  smoothenCoordinates(x, y) {
    if (!this.lastX) {
      this.lastX = x;
      this.lastY = y;
      return [x, y];
    }

    const smoothingFactor = 0.6; 
    const smoothX = this.lastX + (x - this.lastX) * smoothingFactor;
    const smoothY = this.lastY + (y - this.lastY) * smoothingFactor;

    this.lastX = smoothX;
    this.lastY = smoothY;

    return [smoothX, smoothY];
  }

  drawSmoothLine(ctx, points) {
    if (points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    if (points.length > 1) {
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.stroke();
  }

  saveDrawingState() {
    // Remove any redo states
    if (this.currentHistoryIndex < this.drawingHistory.length - 1) {
      this.drawingHistory = this.drawingHistory.slice(0, this.currentHistoryIndex + 1);
    }

    // Create a copy of current canvas state
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.drawingCanvas.width;
    tempCanvas.height = this.drawingCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.drawingCanvas, 0, 0);

    // Add to history
    this.drawingHistory.push(tempCanvas);
    this.currentHistoryIndex++;

    // Limit history size
    if (this.drawingHistory.length > this.maxHistorySteps) {
      this.drawingHistory.shift();
      this.currentHistoryIndex--;
    }
  }

  undo() {
    if (this.currentHistoryIndex > 0) {
      this.currentHistoryIndex--;
      this.ctx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
      this.ctx.drawImage(this.drawingHistory[this.currentHistoryIndex], 0, 0);
    }
  }

  redo() {
    if (this.currentHistoryIndex < this.drawingHistory.length - 1) {
      this.currentHistoryIndex++;
      this.ctx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
      this.ctx.drawImage(this.drawingHistory[this.currentHistoryIndex], 0, 0);
    }
  }

  onResults(results) {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.drawVirtualControls(ctx);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.isDrawing = false;
      this.modeIndicator.textContent = 'Mode: No hand detected';
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8];
    const thumbIsUp = this.isThumbUp(landmarks);
    const fourFingersUp = this.isFourFingersUp(landmarks);
  
    if (fourFingersUp) {
      this.isDrawing = false;
      this.lastX = null;
      this.lastY = null;
      this.modeIndicator.textContent = 'Mode: Navigation';
      ctx.strokeStyle = 'rgba(255,0,0,0.5)';
      ctx.lineWidth = 2;
      window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS);
      results.multiHandLandmarks[0].forEach(landmark => {
        ctx.beginPath();
        ctx.arc(
          landmark.x * this.canvas.width,
          landmark.y * this.canvas.height,
          3,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = 'rgba(255,0,0,0.5)';
        ctx.fill();
      });
      return;
    }
    
    if (thumbIsUp) {
      this.modeIndicator.textContent = 'Mode: Drawing';
      const x = indexTip.x * this.drawingCanvas.width;
      const y = indexTip.y * this.drawingCanvas.height;
      const [smoothX, smoothY] = this.smoothenCoordinates(x, y);

      if (!this.isDrawing) {
        this.startX = smoothX;
        this.startY = smoothY;
        this.isDrawing = true;
        this.points = []; 
        this.pointsCount = 0;

        this.tempCanvas.width = this.drawingCanvas.width;
        this.tempCanvas.height = this.drawingCanvas.height;
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        
        if (this.currentTool === 'eraser') {
          this.ctx.lineWidth = this.eraserSize;
        } else {
          this.ctx.lineWidth = this.brushSize;
        }
      }

      this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

      this.tempCtx.strokeStyle = this.currentColor;
      this.tempCtx.lineWidth = this.brushSize;
      this.tempCtx.lineCap = 'round';
      this.tempCtx.lineJoin = 'round';

      switch(this.currentTool) {
        case 'pen':
          if (this.pointsCount % 2 === 0) { 
            this.points.push({x: smoothX, y: smoothY});
          }
          this.pointsCount++;
          
          if (this.points.length > 1) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.brushSize;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.drawSmoothLine(this.ctx, this.points);
          }
          break;

        case 'eraser':
          if (this.pointsCount % 2 === 0) {
            this.points.push({x: smoothX, y: smoothY});
          }
          this.pointsCount++;
          
          if (this.points.length > 1) {
            this.ctx.beginPath();
            this.ctx.lineWidth = this.eraserSize;
            this.drawSmoothLine(this.ctx, this.points);
          }
          break;

        case 'line':
          this.tempCtx.beginPath();
          this.tempCtx.moveTo(this.startX, this.startY);
          this.tempCtx.lineTo(smoothX, smoothY);
          this.tempCtx.stroke();
          break;
        
        case 'rectangle':
          this.tempCtx.strokeRect(
            this.startX,
            this.startY,
            smoothX - this.startX,
            smoothY - this.startY
          );
          break;
        
        case 'square':
          const size = Math.min(
            Math.abs(smoothX - this.startX),
            Math.abs(smoothY - this.startY)
          );
          const signX = Math.sign(smoothX - this.startX);
          const signY = Math.sign(smoothY - this.startY);
          this.tempCtx.strokeRect(
            this.startX,
            this.startY,
            size * signX,
            size * signY
          );
          break;
        
        case 'triangle':
          this.tempCtx.beginPath();
          this.tempCtx.moveTo(this.startX, this.startY);
          this.tempCtx.lineTo(smoothX, smoothY);
          this.tempCtx.lineTo(this.startX - (smoothX - this.startX), smoothY);
          this.tempCtx.closePath();
          this.tempCtx.stroke();
          break;
        
        case 'circle':
          const radius = Math.sqrt(
            Math.pow(smoothX - this.startX, 2) +
            Math.pow(smoothY - this.startY, 2)
          );
          this.tempCtx.beginPath();
          this.tempCtx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
          this.tempCtx.stroke();
          break;
      }

      if (this.currentTool !== 'pen' && this.currentTool !== 'eraser') {
        ctx.drawImage(this.tempCanvas, 0, 0);
      }
    } else if (this.isDrawing) {
      if (this.currentTool !== 'pen' && this.currentTool !== 'eraser') {
        const mainCtx = this.drawingCanvas.getContext('2d');
        mainCtx.strokeStyle = this.currentColor;
        mainCtx.lineWidth = this.brushSize;
        mainCtx.lineCap = 'round';
        mainCtx.lineJoin = 'round';
      
        switch(this.currentTool) {
          case 'line':
            mainCtx.beginPath();
            mainCtx.moveTo(this.startX, this.startY);
            mainCtx.lineTo(this.lastX, this.lastY);
            mainCtx.stroke();
            break;
        
          case 'rectangle':
            mainCtx.strokeRect(
              this.startX,
              this.startY,
              this.lastX - this.startX,
              this.lastY - this.startY
            );
            break;
        
          case 'square':
            const size = Math.min(
              Math.abs(this.lastX - this.startX),
              Math.abs(this.lastY - this.startY)
            );
            const signX = Math.sign(this.lastX - this.startX);
            const signY = Math.sign(this.lastY - this.startY);
            mainCtx.strokeRect(
              this.startX,
              this.startY,
              size * signX,
              size * signY
            );
            break;
        
          case 'triangle':
            mainCtx.beginPath();
            mainCtx.moveTo(this.startX, this.startY);
            mainCtx.lineTo(this.lastX, this.lastY);
            mainCtx.lineTo(this.startX - (this.lastX - this.startX), this.lastY);
            mainCtx.closePath();
            mainCtx.stroke();
            break;
        
          case 'circle':
            const radius = Math.sqrt(
              Math.pow(this.lastX - this.startX, 2) +
              Math.pow(this.lastY - this.startY, 2)
            );
            mainCtx.beginPath();
            mainCtx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
            mainCtx.stroke();
            break;
        }
      }
      this.isDrawing = false;
      this.startX = null;
      this.startY = null;
      this.lastX = null;
      this.lastY = null;
      this.saveDrawingState();
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const indexTip = landmarks[8];
      
      const x = indexTip.x * this.drawingCanvas.width;
      const y = indexTip.y * this.drawingCanvas.height;

      if (!thumbIsUp) {
        this.handleVirtualControls(x, y);
      }

      ctx.strokeStyle = thumbIsUp ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)';
      ctx.lineWidth = 2;
      window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS);
      
      ctx.fillStyle = thumbIsUp ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)';
      results.multiHandLandmarks[0].forEach(landmark => {
        ctx.beginPath();
        ctx.arc(
          landmark.x * this.canvas.width,
          landmark.y * this.canvas.height,
          3,
          0,
          2 * Math.PI
        );
        ctx.fill();
      });
    }
  }

  isFourFingersUp(landmarks) {
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const ringMcp = landmarks[13];
    const pinkyMcp = landmarks[17];
    
    const thumbTip = landmarks[4];
    
    const handSize = Math.sqrt(
      Math.pow(landmarks[17].x - landmarks[5].x, 2) +
      Math.pow(landmarks[17].y - landmarks[5].y, 2)
    );
    
    const isIndexUp = indexTip.y < indexMcp.y;
    const isMiddleUp = middleTip.y < middleMcp.y;
    const isRingUp = ringTip.y < ringMcp.y;
    const isPinkyUp = pinkyTip.y < pinkyMcp.y;
    
    const isThumbDown = thumbTip.y > Math.min(indexMcp.y, middleMcp.y, ringMcp.y, pinkyMcp.y);
    
    const fingerSpread = Math.abs(indexTip.x - pinkyTip.x) / handSize;
    const areFingersSeparated = fingerSpread > 0.2;
    
    if (Math.random() < 0.01) {
      console.log('Four Fingers Analysis:', {
        isIndexUp,
        isMiddleUp,
        isRingUp,
        isPinkyUp,
        isThumbDown,
        fingerSpread,
        areFingersSeparated
      });
    }
    
    return isIndexUp && isMiddleUp && isRingUp && isPinkyUp && 
           isThumbDown && areFingersSeparated;
  }
}

function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + 
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1);
}

function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return '#' + (0x1000000 + 
    (R > 0 ? R : 0) * 0x10000 + 
    (G > 0 ? G : 0) * 0x100 + 
    (B > 0 ? B : 0)
  ).toString(16).slice(1);
}

function drawPenIcon(ctx, x, y, size, isActive) {
  ctx.save();
  const scale = size / 40;
  ctx.translate(x + size/2, y + size/2);
  ctx.scale(scale, scale);
  ctx.rotate(-45 * Math.PI / 180);

  const bodyGradient = ctx.createLinearGradient(-8, -15, 8, 15);
  bodyGradient.addColorStop(0, '#666666');
  bodyGradient.addColorStop(0.5, '#444444');
  bodyGradient.addColorStop(1, '#333333');

  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(6, -8);
  ctx.lineTo(6, 15);
  ctx.lineTo(-6, 15);
  ctx.lineTo(-6, -8);
  ctx.closePath();
  ctx.fillStyle = bodyGradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(4, -15);
  ctx.lineTo(-4, -15);
  ctx.closePath();
  const tipGradient = ctx.createLinearGradient(0, -20, 0, -15);
  tipGradient.addColorStop(0, '#ffd700');
  tipGradient.addColorStop(1, '#ffa500');
  ctx.fillStyle = tipGradient;
  ctx.fill();

  ctx.restore();
}

function drawEraserIcon(ctx, x, y, size, isActive) {
  ctx.save();
  const scale = size / 40;
  ctx.translate(x + size/2, y + size/2);
  ctx.scale(scale, scale);
  ctx.rotate(-45 * Math.PI / 180);

  const bodyGradient = ctx.createLinearGradient(-10, -15, 10, 15);
  bodyGradient.addColorStop(0, '#ffffff');
  bodyGradient.addColorStop(1, '#e0e0e0');

  ctx.beginPath();
  ctx.roundRect(-10, -15, 20, 30, 3);
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-10, -15, 20, 10, 3);
  ctx.fillStyle = '#ff6b6b';
  ctx.fill();
  ctx.strokeStyle = '#e74c3c';
  ctx.stroke();

  ctx.restore();
}

function drawLineIcon(ctx, x, y, size, isActive) {
  ctx.save();
  ctx.translate(x + size/2, y + size/2);
  ctx.beginPath();
  ctx.moveTo(-size/3, -size/3);
  ctx.lineTo(size/3, size/3);
  ctx.strokeStyle = isActive ? '#000' : '#666';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawRectIcon(ctx, x, y, size, isActive) {
  ctx.save();
  ctx.translate(x + size/2, y + size/2);
  ctx.strokeStyle = isActive ? '#000' : '#666';
  ctx.lineWidth = 2;
  ctx.strokeRect(-size/3, -size/3, (size/3)*2, (size/3)*2);
  ctx.restore();
}

function drawSquareIcon(ctx, x, y, size, isActive) {
  ctx.save();
  ctx.translate(x + size/2, y + size/2);
  ctx.strokeStyle = isActive ? '#000' : '#666';
  ctx.lineWidth = 2;
  const squareSize = size/2;
  ctx.strokeRect(-squareSize/2, -squareSize/2, squareSize, squareSize);
  ctx.restore();
}

function drawTriangleIcon(ctx, x, y, size, isActive) {
  ctx.save();
  ctx.translate(x + size/2, y + size/2);
  ctx.beginPath();
  ctx.moveTo(0, -size/3);
  ctx.lineTo(size/3, size/3);
  ctx.lineTo(-size/3, size/3);
  ctx.closePath();
  ctx.strokeStyle = isActive ? '#000' : '#666';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawCircleIcon(ctx, x, y, size, isActive) {
  ctx.save();
  ctx.translate(x + size/2, y + size/2);
  ctx.beginPath();
  ctx.arc(0, 0, size/3, 0, Math.PI * 2);
  ctx.strokeStyle = isActive ? '#000' : '#666';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

window.onload = () => {
  try {
    if (!window.Hands || !window.Camera) {
      console.error('MediaPipe libraries not loaded properly');
      return;
    }

    const requiredElements = [
      'video',
      'canvas',
      'drawing-canvas',
      'mode-indicator',
      'start-camera',
      'stop-camera',
      'clear'
    ];

    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
      console.error('Missing required DOM elements:', missingElements);
      return;
    }

    new VirtualDrawingApp();
  } catch (error) {
    console.error('Error initializing app:', error);
  }
};