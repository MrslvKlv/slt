// ==UserScript==
// @name         Queue v1.0 ( 0102446 )
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       ( 0102446 )
// @description  Queue Hyperscans and Auto Drop to VR trailer zones.
// @match        file:///F:/WebDevelopment/IXDaSLOT/test_webpage.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Queue system to prevent conflicts
    const scanQueue = [];
    const processedRecords = new Set(); // Track processed items
    let isProcessing = false;
    let scannerActive = true;
    let csxCount = 0;
    let nonCsxCount = 0;
    let duplicateCount = 0;

    // Config
    const INPUT_SELECTOR = '#sd_input'; // Production input field
    const SUBMIT_DELAY = 500; // ms between submissions

    // Create UI Panel
    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'scannerPanel';
        panel.innerHTML = `
            <div style="position:fixed;top:10px;right:10px;background:#2c3e50;color:#ecf0f1;padding:15px;border-radius:8px;z-index:10000;min-width:280px;font-family:monospace;box-shadow:0 4px 6px rgba(0,0,0,0.3)">
                <h3 style="margin:0 0 10px 0;font-size:14px;">Scanner Queue (csX only)</h3>
                <div><span style="color:#3498db;">Queue:</span> <span id="queueCount">0</span></div>
                <div><span style="color:#e74c3c;">Processing:</span> <span id="processingStatus">Idle</span></div>
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid #34495e;">
                    <div style="margin-bottom:5px;"><span style="color:#95a5a6;">Total Scanned:</span> <strong><span id="totalCount">0</span></strong></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                        <span style="color:#27ae60;">✓ csX:</span> 
                        <span><span id="csxCount">0</span> (<span id="csxPercent">0</span>%)</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                        <span style="color:#e74c3c;">✗ Non-csX:</span> 
                        <span><span id="nonCsxCount">0</span> (<span id="nonCsxPercent">0</span>%)</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="color:#f39c12;">⟳ Duplicates:</span> 
                        <span id="duplicateCount">0</span>
                    </div>
                </div>
                <div style="margin-top:10px">
                    <button id="toggleScanner" style="background:#27ae60;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;margin-right:5px;">Pause</button>
                    <button id="clearQueue" style="background:#e74c3c;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Clear</button>
                </div>
                <textarea id="scannerInput" placeholder="Scanner input (press Enter)" style="width:100%;margin-top:10px;padding:5px;border-radius:4px;border:1px solid #34495e;"></textarea>
                <div id="lastScanned" style="margin-top:5px;font-size:11px;color:#95a5a6;"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // Event listeners
        document.getElementById('toggleScanner').addEventListener('click', toggleScanner);
        document.getElementById('clearQueue').addEventListener('click', clearQueue);
        document.getElementById('scannerInput').addEventListener('keypress', handleScannerInput);
        
        // Initial UI update
        updateUI();
    }

    // Add item to queue
    function addToQueue(data) {
        if (!scannerActive) return;
        
        // Filter: only accept inputs starting with "csx" (case-insensitive)
        const csxPattern = /^csx/i;
        if (!csxPattern.test(data)) {
            nonCsxCount++;
            document.getElementById('lastScanned').textContent = `Ignored: ${data} (must start with csX)`;
            document.getElementById('lastScanned').style.color = '#e74c3c';
            updateUI();
            return;
        }
        
        // Check for duplicates
        const normalizedData = data.toLowerCase();
        if (processedRecords.has(normalizedData)) {
            duplicateCount++;
            document.getElementById('lastScanned').textContent = `Duplicate: ${data} (already processed)`;
            document.getElementById('lastScanned').style.color = '#f39c12';
            updateUI();
            return;
        }
        
        csxCount++;
        const timestamp = new Date().toLocaleTimeString();
        scanQueue.push({ data, timestamp });
        processedRecords.add(normalizedData);
        updateUI();
        document.getElementById('lastScanned').textContent = `Last: ${data} at ${timestamp}`;
        document.getElementById('lastScanned').style.color = '#27ae60';
        
        // Start processing if not already running
        if (!isProcessing) {
            processQueue();
        }
    }

    // Process queue sequentially
    async function processQueue() {
        if (isProcessing || scanQueue.length === 0) return;
        
        isProcessing = true;
        updateUI();

        while (scanQueue.length > 0) {
            const item = scanQueue.shift();
            updateUI();
            
            try {
                await submitToWebpage(item.data);
                await sleep(SUBMIT_DELAY);
            } catch (error) {
                console.error('Submission error:', error);
                // Re-add to queue on failure
                scanQueue.unshift(item);
                break;
            }
        }

        isProcessing = false;
        updateUI();
    }

    // Submit data to webpage
    function submitToWebpage(data) {
        return new Promise((resolve, reject) => {
            const input = document.querySelector(INPUT_SELECTOR);

            if (!input) {
                reject('Input field not found');
                return;
            }

            // Set value
            input.value = data;
            
            // Trigger input event (for React/Vue)
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Trigger change event (for jQuery)
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Simulate Enter key press to trigger submission
            const enterEvent = new KeyboardEvent('keypress', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(enterEvent);
            
            // Also try keydown for jQuery handlers
            const keydownEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(keydownEvent);
            
            // Trigger jQuery events if jQuery is present
            if (window.jQuery) {
                window.jQuery(input).trigger('change');
                window.jQuery(input).trigger({ type: 'keypress', which: 13, keyCode: 13 });
            }
            
            setTimeout(resolve, 100);
        });
    }

    // Handle scanner input
    function handleScannerInput(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = e.target;
            const value = input.value.trim();
            
            if (value) {
                addToQueue(value);
                input.value = '';
            }
        }
    }

    // Toggle scanner
    function toggleScanner() {
        scannerActive = !scannerActive;
        const btn = document.getElementById('toggleScanner');
        btn.textContent = scannerActive ? 'Pause' : 'Resume';
        btn.style.background = scannerActive ? '#27ae60' : '#e67e22';
        updateUI();
    }

    // Clear queue
    function clearQueue() {
        scanQueue.length = 0;
        processedRecords.clear();
        csxCount = 0;
        nonCsxCount = 0;
        duplicateCount = 0;
        updateUI();
    }

    // Update UI
    function updateUI() {
        const total = csxCount + nonCsxCount;
        const csxPercent = total > 0 ? Math.round((csxCount / total) * 100) : 0;
        const nonCsxPercent = total > 0 ? Math.round((nonCsxCount / total) * 100) : 0;
        
        document.getElementById('queueCount').textContent = scanQueue.length;
        document.getElementById('processingStatus').textContent = 
            isProcessing ? 'Active' : (scannerActive ? 'Idle' : 'Paused');
        document.getElementById('totalCount').textContent = total;
        document.getElementById('csxCount').textContent = csxCount;
        document.getElementById('nonCsxCount').textContent = nonCsxCount;
        document.getElementById('csxPercent').textContent = csxPercent;
        document.getElementById('nonCsxPercent').textContent = nonCsxPercent;
        document.getElementById('duplicateCount').textContent = duplicateCount;
    }

    // Utility
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Initialize
    createPanel();
    console.log('Conveyor Scanner Script loaded');
})();
