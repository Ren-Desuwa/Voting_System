// Fixed admin.js - Fully functional admin panel with PIN management
let positions = [];
let parties = [];
let analyticsData = null;
let currentPartyId = null;
let analyticsAutoRefresh = null;
let lastDataHash = null;
let electionControlRefreshInterval = null;

// Global variable to track state and prevent unnecessary DOM rewrites
let lastKnownStatus = null;
 // For drag-and-drop position reordering

document.addEventListener('DOMContentLoaded', () => {
    loadPositions();
    loadPartyList();
    renderSettingsMode();
});
// Clean up interval when leaving the page or switching tabs
document.addEventListener('visibilitychange', () => {
    if (document.hidden && electionControlRefreshInterval) {
        console.log('⏸️ Page hidden - pausing auto-refresh');
        clearInterval(electionControlRefreshInterval);
        electionControlRefreshInterval = null;
    }
});

// ==========================================
// TAB SWITCHING
// ==========================================
// Also stop auto-refresh when switching to other admin tabs
function switchMainTab(tab) {
    // Stop election control auto-refresh when switching tabs
    if (electionControlRefreshInterval) {
        clearInterval(electionControlRefreshInterval);
        electionControlRefreshInterval = null;
        console.log('⏸️ Switched tabs - stopping election control auto-refresh');
    }
    
    // Continue with normal tab switching...
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.panel-content').forEach(el => el.style.display = 'none');
    
    if(tab === 'setup') {
        document.querySelector('.nav-tab:first-child').classList.add('active');
        document.getElementById('setupView').style.display = 'grid';
        
        // Stop analytics auto-refresh when leaving analytics
        if(analyticsAutoRefresh) {
            clearInterval(analyticsAutoRefresh);
            analyticsAutoRefresh = null;
            console.log('⏸️ Analytics auto-refresh paused');
        }
    } else {
        document.querySelector('.nav-tab:last-child').classList.add('active');
        document.getElementById('analyticsView').style.display = 'grid';
        loadDashboard();
        
        // Start analytics auto-refresh when entering analytics
        if(analyticsAutoRefresh) {
            clearInterval(analyticsAutoRefresh);
        }
        analyticsAutoRefresh = setInterval(() => {
            loadDashboard();
        }, 3000);
        
        console.log('▶️ Analytics auto-refresh started (3s interval)');
    }
}

// ==========================================
// SETUP TAB: SIDEBAR PARTY LIST
// ==========================================
async function loadPartyList() {
    try {
        const res = await fetch('api/get_stats_full.php');
        const data = await res.json();
        parties = data.global.parties || [];
        
        const container = document.getElementById('partyListNav');
        container.innerHTML = parties.map(p => `
            <div class="nav-item" data-party-id="${p.id || p.name}" onclick="loadAndRenderParty('${p.name}')">
                <div style="width:10px; height:10px; border-radius:50%; background:${p.color}"></div>
                ${p.name}
            </div>
        `).join('');
    } catch(e) {
        console.error("Failed to load parties:", e);
    }
}

// ==========================================
// MODE A: GLOBAL SETTINGS (with PIN Management)
// ==========================================
async function renderSettingsMode() {
    // Highlight sidebar
    document.querySelectorAll('.col-nav .nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-global').classList.add('active');
    currentPartyId = null;

    // Fetch current settings
    const resVoters = await fetch('api/settings.php?key=total_voters');
    const dataVoters = await resVoters.json();
    const currentTotal = dataVoters.value || 0;
    
    const resPin = await fetch('api/settings.php?key=daily_pin');
    const dataPin = await resPin.json();
    const currentPin = dataPin.value || '1234';

    const container = document.getElementById('setupDynamicContent');
    container.innerHTML = `
        <div class="col-content" style="grid-column: 2 / 4; background: white; padding: 30px;">
            <h2 style="margin-bottom: 20px;">⚙️ Global Configuration</h2>
            
            <!-- TAILSCALE URL BANNER -->
            <div id="tailscaleUrlBanner" style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(8, 145, 178, 0.3);">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="font-size: 2em;">🌐</div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0; font-size: 1.2em;">Remote Access URL</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 0.9em;">Share this link with teachers and proctors</p>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 8px; padding: 15px; display: flex; gap: 10px; align-items: center;">
                    <div style="flex: 1; font-family: 'Courier New', monospace; font-size: 1.1em; word-break: break-all;" id="tailscaleUrlDisplay">
                        <span style="opacity: 0.7;">Loading...</span>
                    </div>
                    <button onclick="copyTailscaleUrl()" id="copyUrlBtn" style="background: white; color: #0891b2; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.3s;">
                        📋 Copy
                    </button>
                </div>
                <div style="margin-top: 15px; font-size: 0.85em; opacity: 0.9;" id="tailscaleStatus">
                    Checking Tailscale connection...
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:30px;">
                <!-- COLUMN 1: System Settings -->
                <div>
                    <h3>System Settings</h3>
                    
                    <label style="display:block; margin-top:20px; font-weight:600;">Total Enrolled Students</label>
                    <p style="color:#666; font-size:0.9em; margin-bottom:10px;">Used for analytics calculations</p>
                    <div style="display:flex; gap:10px; margin-bottom:30px;">
                        <input type="number" id="totalVotersInput" value="${currentTotal}" style="flex:1;">
                        <button type="button" onclick="saveTotalVoters()" style="background:#d4a017; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; white-space:nowrap;">Save</button>
                    </div>
                    
                    <label style="display:block; margin-top:20px; font-weight:600;">🔐 Daily Access PIN</label>
                    <p style="color:#666; font-size:0.9em; margin-bottom:10px;">Clients must enter this PIN to access voting</p>
                    <div style="display:flex; gap:10px; margin-bottom:15px;">
                        <input type="text" id="dailyPinInput" value="${currentPin}" style="flex:1; font-size:1.2em; letter-spacing:2px; text-align:center; font-weight:bold;">
                        <button type="button" onclick="saveDailyPin()" style="background:#d4a017; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; white-space:nowrap;">Save PIN</button>
                    </div>
                    
                    <div style="background:#fff8e1; border-left:4px solid #f1c40f; padding:15px; border-radius:6px; margin-bottom:20px;">
                        <strong style="color:#f39c12;">ℹ️ How PIN Access Works:</strong>
                        <ul style="margin:10px 0 0 20px; color:#666; font-size:0.9em; line-height:1.6;">
                            <li>Clients enter the PIN once to get access</li>
                            <li>Session lasts until midnight (11:59 PM)</li>
                            <li>No need to re-enter PIN during the day</li>
                            <li>Share this PIN with authorized voters only</li>
                        </ul>
                    </div>
                    
                    <button type="button" onclick="viewActiveSessions()" style="width:100%; padding:12px; background:#3498db; color:white; border:none; border-radius:6px; cursor:pointer; margin-bottom:10px;">
                        👥 View Active Sessions
                    </button>
                    
                    <button type="button" onclick="clearAllSessions()" style="width:100%; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer;">
                        🚫 Clear All Sessions
                    </button>
                </div>

                <!-- COLUMN 2: Position Manager -->
                <div style="border-left:1px solid #eee; padding-left:30px;">
                    <h3>Position Manager</h3>
                    <p style="color:#666; font-size:0.9em; margin-bottom:15px;">Add or remove voting positions</p>
                    <div style="display: flex; gap: 10px; margin-bottom:20px;">
                        <input type="text" id="newPosTitle" placeholder="e.g., President" style="flex:1;">
                        <button type="button" onclick="addPosition()" style="background:#d4a017; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer;">Add</button>
                    </div>
                    <div id="settingsPosList" style="max-height:450px; overflow-y:auto;">
                        ${positions.map((p, index) => `
                            <div class="position-item" data-position-id="${p.id}" data-order="${index}" draggable="true" style="padding:12px; border:1px solid #eee; margin-bottom:8px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; background:#fafafa; cursor:move; transition: all 0.3s;">
                                <div style="display:flex; align-items:center; gap:10px; flex:1;">
                                    <span style="color:#999; cursor:grab; font-size:1.2em;" title="Drag to reorder">⋮⋮</span>
                                    <span style="font-weight:500;">${p.title}</span>
                                    <span style="color:#999; font-size:0.85em;">(Order: ${index + 1})</span>
                                </div>
                                <div style="display:flex; gap:5px; align-items:center;">
                                    <button onclick="movePositionUp(${index})" ${index === 0 ? 'disabled' : ''} style="background:none; border:1px solid #d4a017; color:#d4a017; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.9em;" title="Move up">▲</button>
                                    <button onclick="movePositionDown(${index})" ${index === positions.length - 1 ? 'disabled' : ''} style="background:none; border:1px solid #d4a017; color:#d4a017; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.9em;" title="Move down">▼</button>
                                    <span onclick="deletePosition(${p.id})" style="color:#e74c3c; cursor:pointer; font-size:1.5em; line-height:1; padding:5px; margin-left:5px;" title="Delete position">&times;</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <p style="color:#999; font-size:0.85em; margin-top:10px;">💡 Drag positions or use ▲▼ buttons to reorder</p>
                </div>
                
                <!-- COLUMN 3: Quick Stats -->
                <div style="border-left:1px solid #eee; padding-left:30px;">
                    <h3>Quick Info</h3>
                    <div id="quickStatsArea">
                        <p style="color:#999;">Loading stats...</p>
                    </div>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px dashed #eee;">
                        <h4 style="color: #c0392b; margin-bottom: 10px; font-size: 0.9em; text-transform: uppercase;">⚠️ Danger Zone</h4>
                        <button id="finishElectionBtn" type="button" onclick="finishElection()" 
                            style="width:100%; padding:15px; background: linear-gradient(135deg, #c0392b 0%, #a93226 100%); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; box-shadow: 0 4px 10px rgba(192, 57, 43, 0.3); transition: all 0.2s;">
                            🏁 FINISH ELECTION
                        </button>
                        <p style="font-size: 0.8em; color: #999; margin-top: 8px; text-align: center;">
                            Seals database & generates results.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Load quick stats
    loadQuickStats();
    
    // Load Tailscale URL
    loadTailscaleUrl();
    
    // Initialize drag-and-drop for position reordering
    initializePositionDragAndDrop();
}

// ==========================================
// UPDATED NETWORK INFO & COPY FUNCTIONS
// ==========================================
async function loadTailscaleUrl() {
    const urlDisplay = document.getElementById('tailscaleUrlDisplay');
    const statusDisplay = document.getElementById('tailscaleStatus');
    
    // 1. Show Loading State
    if (urlDisplay) urlDisplay.innerHTML = '<div style="opacity:0.7; padding:10px;">🔍 Scanning Network...</div>';

    try {
        // 2. Fetch connection info
        const res = await fetch('api/get_tailscale_info.php?t=' + new Date().getTime());
        const data = await res.json();

        // 3. Prepare Variables
        const remoteUrl = data.url || "Unavailable";
        // Assume port 8080 for local if not specified
        const localUrl = data.lan_ip ? `http://${data.lan_ip}:8080` : "Unavailable";
        
        // 4. Build Side-by-Side HTML (Flexbox)
        let html = `
        <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: stretch;">
            
            <div style="flex: 1; min-width: 250px; background: rgba(255,255,255,0.15); border-radius: 8px; padding: 12px; border-left: 4px solid #a5f3fc; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="color: #a5f3fc; font-size: 0.75em; text-transform: uppercase; font-weight:bold; letter-spacing:1px;">🌍 Remote / Internet</span>
                    ${data.url ? 
                        `<button onclick="copyTextToClipboard('${remoteUrl}', this)" style="background:white; color:#0891b2; border:none; padding:4px 10px; border-radius:4px; font-size:0.75em; cursor:pointer; font-weight:bold; transition:all 0.2s;">COPY</button>` 
                        : ''}
                </div>
                <div style="font-family:'Courier New', monospace; font-weight:bold; font-size:0.95em; word-break:break-all; color:white;">
                    ${remoteUrl}
                </div>
            </div>

            <div style="flex: 1; min-width: 250px; background: rgba(255,255,255,0.15); border-radius: 8px; padding: 12px; border-left: 4px solid #bef264; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="color: #bef264; font-size: 0.75em; text-transform: uppercase; font-weight:bold; letter-spacing:1px;">🏠 Local LAN (Wi-Fi)</span>
                    ${data.lan_ip ? 
                        `<button onclick="copyTextToClipboard('${localUrl}', this)" style="background:white; color:#65a30d; border:none; padding:4px 10px; border-radius:4px; font-size:0.75em; cursor:pointer; font-weight:bold; transition:all 0.2s;">COPY</button>` 
                        : ''}
                </div>
                <div style="font-family:'Courier New', monospace; font-weight:bold; font-size:0.95em; word-break:break-all; color:white;">
                    ${localUrl}
                </div>
            </div>

        </div>`;

        // 5. Render
        urlDisplay.innerHTML = html;

        // 6. Update Status Text
        if (data.url) {
            statusDisplay.innerHTML = "✅ System Online (Remote + Local)";
            statusDisplay.style.color = "#d1fae5";
        } else {
            statusDisplay.innerHTML = "⚠️ LAN Only (Remote Offline)";
            statusDisplay.style.color = "#fef08a"; 
        }

    } catch (e) {
        console.error("Network Error:", e);
        urlDisplay.innerHTML = '<div style="color:#fca5a5;">❌ Connection Error</div>';
    }
}

// GENERIC COPY FUNCTION (Replaces the old copyTailscaleUrl)
// Works for both Remote and Local buttons
function copyTextToClipboard(text, btnElementOrId) {
    if (!text) return;

    // Handle button element (ID string or actual DOM element)
    let btn = (typeof btnElementOrId === 'string') ? document.getElementById(btnElementOrId) : btnElementOrId;
    let originalText = btn ? btn.innerHTML : "Copy";
    let originalBg = btn ? btn.style.background : "";

    navigator.clipboard.writeText(text).then(() => {
        if (btn) {
            btn.innerHTML = '✓ Copied!';
            btn.style.background = '#10b981'; // Green
            btn.style.borderColor = '#10b981';
            
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = originalBg;
                btn.style.borderColor = '';
            }, 2000);
        } else {
            alert("Copied: " + text);
        }
    }).catch(err => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            if(btn) {
                btn.innerHTML = '✓ Copied!';
                setTimeout(() => btn.innerHTML = originalText, 2000);
            } else {
                alert('Copied: ' + text);
            }
        } catch (e) {
            prompt("Copy manually:", text);
        }
        document.body.removeChild(textArea);
    });
}

async function loadQuickStats() {
    try {
        const res = await fetch('api/get_stats_full.php');
        const data = await res.json();
        
        const container = document.getElementById('quickStatsArea');
        if(!container) return;
        
        container.innerHTML = `
            <div style="background:#e8f5e9; padding:15px; border-radius:8px; margin-bottom:15px;">
                <div style="font-size:2em; font-weight:bold; color:#2e7d32;">${data.global.votes_cast || 0}</div>
                <div style="color:#666; font-size:0.9em;">Votes Cast Today</div>
            </div>
            
            <div style="background:#e3f2fd; padding:15px; border-radius:8px; margin-bottom:15px;">
                <div style="font-size:2em; font-weight:bold; color:#1976d2;">${data.global.pending || 0}</div>
                <div style="color:#666; font-size:0.9em;">Pending Voters</div>
            </div>
            
            <div style="background:#fff3e0; padding:15px; border-radius:8px; margin-bottom:15px;">
                <div style="font-size:2em; font-weight:bold; color:#f57c00;">${data.global.parties?.length || 0}</div>
                <div style="color:#666; font-size:0.9em;">Registered Parties</div>
            </div>
            
            <div style="background:#fce4ec; padding:15px; border-radius:8px;">
                <div style="font-size:2em; font-weight:bold; color:#c2185b;">${data.positions?.length || 0}</div>
                <div style="color:#666; font-size:0.9em;">Active Positions</div>
            </div>
        `;
    } catch(e) {
        console.error('Failed to load quick stats:', e);
    }
}

async function saveTotalVoters() {
    const value = document.getElementById('totalVotersInput').value;
    try {
        await fetch('api/settings.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `key=total_voters&value=${value}`
        });
        alert('✓ Total voters updated successfully!');
        loadQuickStats();
    } catch(e) {
        alert('Error saving settings: ' + e.message);
    }
}

async function saveDailyPin() {
    const pin = document.getElementById('dailyPinInput').value.trim();
    
    if(!pin) {
        alert('PIN cannot be empty');
        return;
    }
    
    if(pin.length < 4) {
        alert('PIN should be at least 4 characters');
        return;
    }
    
    try {
        await fetch('api/settings.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `key=daily_pin&value=${encodeURIComponent(pin)}`
        });
        
        await fetch('api/settings.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `key=pin_updated_date&value=${new Date().toISOString().split('T')[0]}`
        });
        
        alert(`✓ Daily PIN updated to: ${pin}\n\nShare this PIN with authorized voters.`);
    } catch(e) {
        alert('Error saving PIN: ' + e.message);
    }
}

async function viewActiveSessions() {
    try {
        const res = await fetch('api/get_sessions.php');
        const data = await res.json();
        
        if(data.sessions && data.sessions.length > 0) {
            let msg = `Active Sessions (${data.sessions.length}):\n\n`;
            data.sessions.forEach((s, i) => {
                msg += `${i+1}. IP: ${s.ip_address}\n   Created: ${s.created_at}\n   Expires: ${s.expires_at}\n\n`;
            });
            alert(msg);
        } else {
            alert('No active sessions found.');
        }
    } catch(e) {
        alert('Error loading sessions');
    }
}

async function clearAllSessions() {
    if(!confirm('Are you sure you want to clear ALL active sessions?\n\nThis will require all clients to re-enter the PIN.')) {
        return;
    }
    
    try {
        const res = await fetch('api/clear_sessions.php', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'All sessions cleared!');
    } catch(e) {
        alert('Error clearing sessions');
    }
}

// ==========================================
// MODE B: PARTY EDITOR (Unchanged from previous version)
// ==========================================
async function loadAndRenderParty(partyName) {
    try {
        const res = await fetch('api/get_party_full.php?name=' + encodeURIComponent(partyName)+ '&t=' + new Date().getTime());
        const party = await res.json();
        
        if(!party.success) {
            alert('Failed to load party data');
            return;
        }
        
        renderPartyMode(party.data);
    } catch(e) {
        console.error('Error loading party:', e);
        alert('Error loading party data');
    }
}

function renderPartyMode(party) {
    // Clear all nav active states first
    document.querySelectorAll('.col-nav .nav-item').forEach(el => el.classList.remove('active'));
    
    // Only activate if this is an existing party (has a name)
    if(party && party.name && party.name.trim() !== '') {
        const items = document.querySelectorAll('.col-nav .nav-item');
        items.forEach(el => {
            if(el.textContent.trim().includes(party.name)) {
                el.classList.add('active');
            }
        });
    }
    // If it's a new party (empty name), no nav item should be active
    
    currentPartyId = party.id;
    
    const container = document.getElementById('setupDynamicContent');
    container.innerHTML = `
        <form id="partyForm" onsubmit="saveParty(event)" method="POST" style="display: contents;">
            <div class="col-content middle" style="padding:30px;">
                <h3 style="margin-bottom:20px;">1. Party Details</h3>
                
                <input type="hidden" name="party_id" value="${party.id || ''}">
                
                <label style="display:block; font-weight:600; margin-bottom:5px;">Party Name</label>
                <input type="text" name="party_name" value="${party.name || ''}" required style="margin-bottom:20px;">
                
                <label style="display:block; font-weight:600; margin-bottom:5px;">Party Slogan</label>
                <input type="text" name="party_slogan" value="${party.slogan || ''}" placeholder="e.g., Leading with Integrity" style="margin-bottom:20px;">
                
                <label style="display:block; font-weight:600; margin-bottom:5px;">Theme Color</label>
                <input type="color" name="party_color" value="${party.color || '#cccccc'}" style="height:50px; margin-bottom:20px;">
                
                <label style="display:block; font-weight:600; margin-bottom:5px;">Party Logo</label>
                <input type="file" name="party_logo" accept="image/*" style="margin-bottom:20px;">
                ${party.logo_url ? `<img src="${party.logo_url}" style="max-width:100px; margin-bottom:10px; border:1px solid #ddd; border-radius:4px;">` : ''}
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-top:20px;">
                    <button type="submit" class="btn btn-primary" style="background: #d4a017; color:white; border:none; padding:15px; border-radius:6px; font-weight:600; cursor:pointer;">
                        💾 SAVE ENTIRE PARTY
                    </button>
                    ${party.id ? `
                        <button type="button" onclick="deleteParty(${party.id}, '${party.name.replace(/'/g, "\\'")}')" style="background:#e74c3c; color:white; border:none; padding:15px; border-radius:6px; font-weight:600; cursor:pointer;">
                            🗑️ DELETE PARTY
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="col-content right" style="padding:30px; background:#fafafa;">
                <h3 style="margin-bottom:20px;">2. Candidates</h3>
                <div id="partyCandidatesList">
                    ${renderCandidatesList(party.candidates || [])}
                </div>
                <button type="button" class="btn-new-party" onclick="addCandidateSlot()" style="margin-top:15px;">+ Add Candidate</button>
            </div>
        </form>
    `;
}

function renderCandidatesList(candidates) {
    if(!candidates || candidates.length === 0) {
        return '<p style="color:#999; text-align:center; padding:20px;">No candidates yet. Click "+ Add Candidate" to start.</p>';
    }
    
    return candidates.map((c, index) => `
        <div class="cand-card" style="margin-bottom:15px; padding:15px; background:white; border:1px solid #eee; border-radius:8px;">
            <div style="display:flex; gap:15px; align-items:center;">
                <div style="width:50px; height:50px; background:#ddd; border-radius:50%; overflow:hidden; flex-shrink:0;">
                    ${c.photo_url ? `<img src="${c.photo_url}" style="width:100%; height:100%; object-fit:cover;">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:1.5em;">👤</div>'}
                </div>
                <div style="flex:1;">
                    <input type="hidden" name="cand_ids[]" value="${c.id || ''}">
                    <input type="text" name="cand_names[]" value="${c.full_name || ''}" placeholder="Candidate Name" style="margin-bottom:10px;" required>
                    <select name="cand_positions[]" style="margin-bottom:5px;" required>
                        <option value="">Select Position</option>
                        ${positions.map(p => `<option value="${p.id}" ${c.position_id == p.id ? 'selected' : ''}>${p.title}</option>`).join('')}
                    </select>
                    <input type="file" name="cand_photos_${index}" accept="image/*" style="font-size:0.85em;">
                </div>
                <span onclick="removeCandidateSlot(this)" style="color:#e74c3c; cursor:pointer; font-size:1.5em; line-height:1; padding:5px;">&times;</span>
            </div>
        </div>
    `).join('');
}

function addCandidateSlot() {
    const container = document.getElementById('partyCandidatesList');
    const index = container.children.length;
    
    const newSlot = document.createElement('div');
    newSlot.className = 'cand-card';
    newSlot.style.cssText = 'margin-bottom:15px; padding:15px; background:white; border:1px solid #eee; border-radius:8px;';
    newSlot.innerHTML = `
        <div style="display:flex; gap:15px; align-items:center;">
            <div style="width:50px; height:50px; background:#ddd; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.5em; flex-shrink:0;">👤</div>
            <div style="flex:1;">
                <input type="text" name="cand_names[]" placeholder="Candidate Name" style="margin-bottom:10px;" required>
                <select name="cand_positions[]" style="margin-bottom:5px;" required>
                    <option value="">Select Position</option>
                    ${positions.map(p => `<option value="${p.id}">${p.title}</option>`).join('')}
                </select>
                <input type="file" name="cand_photos_${index}" accept="image/*" style="font-size:0.85em;">
            </div>
            <span onclick="removeCandidateSlot(this)" style="color:#e74c3c; cursor:pointer; font-size:1.5em; line-height:1; padding:5px;">&times;</span>
        </div>
    `;
    container.appendChild(newSlot);
}

function removeCandidateSlot(btn) {
    if(confirm('Remove this candidate?')) {
        btn.closest('.cand-card').remove();
    }
}

async function saveParty(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    
    try {
        const res = await fetch('api/save_party_batch.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await res.json();
        
        if(result.success) {
            if(result.deleted) {
                // Party was auto-deleted because it had no candidates
                alert('⚠️ ' + result.message);
                await loadPartyList();
                renderSettingsMode(); // Return to settings view
            } else {
                alert('✓ Party saved successfully!');
                await loadPartyList();
            }
        } else {
            alert('Error: ' + result.message);
        }
    } catch(e) {
        alert('Network error: ' + e.message);
    }
}

async function deleteParty(partyId, partyName) {
    if(!confirm(`Are you sure you want to delete "${partyName}"?\n\nThis will permanently remove the party and ALL its candidates.\n\nThis action cannot be undone!`)) {
        return;
    }
    
    // Double confirmation for safety
    const userInput = prompt(`⚠️ FINAL WARNING ⚠️\n\nYou are about to delete "${partyName}" and all associated candidates.\n\nType the party name exactly to confirm deletion:\n\n(Type: ${partyName})`);
    
    if(userInput !== partyName) {
        if(userInput !== null) { // User didn't click cancel
            alert('Party name did not match. Deletion cancelled.');
        }
        return;
    }
    
    try {
        const res = await fetch('api/delete_party.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `party_id=${partyId}`
        });
        
        const result = await res.json();
        
        if(result.success) {
            alert(`✓ "${partyName}" has been deleted successfully.`);
            await loadPartyList();
            renderSettingsMode(); // Return to settings view
        } else {
            alert('Error: ' + result.message);
        }
    } catch(e) {
        console.error(e);
        alert('Network error while deleting party.');
    }
}

function resetPartyForm() {
    // Clear all navigation active states when creating a new party
    document.querySelectorAll('.col-nav .nav-item').forEach(el => el.classList.remove('active'));
    
    renderPartyMode({
        name: '',
        slogan: '',
        color: '#cccccc',
        candidates: []
    });
}

// ==========================================
// POSITIONS MANAGEMENT
// ==========================================
async function loadPositions() {
    try {
        const res = await fetch('api/manage_positions.php?action=list');
        positions = await res.json();
    } catch(e) {
        console.error('Failed to load positions:', e);
    }
}

async function addPosition() {
    const title = document.getElementById('newPosTitle').value.trim();
    if(!title) {
        alert('Please enter a position title');
        return;
    }
    
    try {
        await fetch('api/manage_positions.php?action=add', { 
            method:'POST', 
            headers:{'Content-Type':'application/x-www-form-urlencoded'}, 
            body:`title=${encodeURIComponent(title)}` 
        });
        
        document.getElementById('newPosTitle').value = '';
        await loadPositions();
        renderSettingsMode();
    } catch(e) {
        alert('Error adding position: ' + e.message);
    }
}

async function deletePosition(id) {
    if(!confirm('Delete this position? This will also remove all candidates running for it!')) {
        return;
    }
    
    try {
        await fetch(`api/manage_positions.php?action=delete&id=${id}`);
        await loadPositions();
        renderSettingsMode();
    } catch(e) {
        alert('Error deleting position: ' + e.message);
    }
}

// ==========================================
// POSITION REORDERING (Drag & Drop)
// ==========================================
let draggedElement = null;

function initializePositionDragAndDrop() {
    const container = document.getElementById('settingsPosList');
    if(!container) return;
    
    const items = container.querySelectorAll('.position-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
    this.style.transform = 'scale(0.98)';
    this.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.style.background = 'linear-gradient(135deg, #fff8e1 0%, #ffe0b2 100%)';
        this.style.borderColor = '#d4a017';
        this.style.borderWidth = '2px';
        this.style.transform = 'translateY(-2px)';
    }
}

function handleDragLeave(e) {
    this.style.background = '#fafafa';
    this.style.borderColor = '#eee';
    this.style.borderWidth = '1px';
    this.style.transform = 'translateY(0)';
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        // Get the container
        const container = document.getElementById('settingsPosList');
        const allItems = Array.from(container.querySelectorAll('.position-item'));
        
        // Find positions
        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(this);
        
        // Reorder in DOM
        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedElement, this);
        }
        
        // Update positions array order
        const movedItem = positions.splice(draggedIndex, 1)[0];
        positions.splice(targetIndex, 0, movedItem);
        
        // Save new order to backend
        savePositionOrder();
    }
    
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    this.style.transform = 'scale(1)';
    this.style.boxShadow = 'none';
    
    // Reset all items
    const items = document.querySelectorAll('.position-item');
    items.forEach(item => {
        item.style.background = '#fafafa';
        item.style.borderColor = '#eee';
        item.style.borderWidth = '1px';
        item.style.transform = 'translateY(0)';
    });
}

async function movePositionUp(index) {
    if (index <= 0) return;
    
    // Swap positions in the array
    const temp = positions[index];
    positions[index] = positions[index - 1];
    positions[index - 1] = temp;
    
    // Save to backend and refresh display
    await savePositionOrder();
    renderSettingsMode();
}

async function movePositionDown(index) {
    if (index >= positions.length - 1) return;
    
    // Swap positions in the array
    const temp = positions[index];
    positions[index] = positions[index + 1];
    positions[index + 1] = temp;
    
    // Save to backend and refresh display
    await savePositionOrder();
    renderSettingsMode();
}

async function savePositionOrder() {
    // Create an array of position IDs in their new order
    const newOrder = positions.map(p => p.id);
    
    try {
        const response = await fetch('api/manage_positions.php?action=reorder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ order: newOrder })
        });
        
        const result = await response.json();
        
        if(result.success) {
            // Update the display to show new order numbers
            const container = document.getElementById('settingsPosList');
            const items = container.querySelectorAll('.position-item');
            items.forEach((item, index) => {
                const orderSpan = item.querySelector('span[style*="color:#999"]');
                if(orderSpan && orderSpan.textContent.includes('Order:')) {
                    orderSpan.textContent = `(Order: ${index + 1})`;
                }
                item.dataset.order = index;
            });
            
            // Show success message briefly
            const container2 = document.getElementById('settingsPosList');
            const existingMsg = container2.parentElement.querySelector('.reorder-success-msg');
            if(existingMsg) existingMsg.remove();
            
            const successMsg = document.createElement('p');
            successMsg.className = 'reorder-success-msg';
            successMsg.style.cssText = 'color:#4caf50; font-size:0.9em; margin-top:10px; font-weight:600;';
            successMsg.textContent = '✓ Position order saved successfully!';
            container2.parentElement.appendChild(successMsg);
            
            setTimeout(() => successMsg.remove(), 3000);
        } else {
            alert('Failed to save position order: ' + (result.message || 'Unknown error'));
            // Reload to reset order
            await loadPositions();
            renderSettingsMode();
        }
    } catch(e) {
        console.error('Error saving position order:', e);
        alert('Error saving position order. Please try again.');
        // Reload to reset order
        await loadPositions();
        renderSettingsMode();
    }
}

// ==========================================
// ANALYTICS TAB (Unchanged from previous version)
// ==========================================
async function loadDashboard() {
    try {
        const res = await fetch('api/get_stats_full.php');
        const data = await res.json();
        
        if(!data.success) {
            console.error('Failed to load analytics');
            return;
        }
        
        // Generate hash of new data
        const newHash = generateDataHash(data);
        
        // Only update if data has changed
        if(newHash !== lastDataHash) {
            console.log('📊 New votes detected - updating display');
            lastDataHash = newHash;
            analyticsData = data;
            
            const navContainer = document.getElementById('analyticsPosList');
            navContainer.innerHTML = data.positions.map((p, idx) => `
                <div class="nav-item" onclick="renderPosStat(${idx})">
                    ${p.title}
                </div>
            `).join('');
            
            renderMainDashboard();
        } else {
            console.log('✓ No changes - skipping refresh');
        }
        
    } catch(e) {
        console.error('Failed to load dashboard:', e);
    }
}

function renderAnalyticsSidebar() {
    const list = document.getElementById('analyticsPosList');
    if(!analyticsData || !analyticsData.positions) {
        list.innerHTML = '<p style="padding:20px; color:#999;">No data available</p>';
        return;
    }
    
    list.innerHTML = analyticsData.positions.map((p, i) => {
        const totalVotes = p.total_votes || 0;
        const remaining = p.remaining || 0;
        const total = totalVotes + remaining;
        
        return `
            <div class="nav-item" onclick="renderPosStat(${i})" style="cursor:pointer;">
                <div style="flex:1">
                    <div style="font-weight:600; margin-bottom:8px;">${p.title}</div>
                    <div style="font-size:0.85em; color:#666; margin-bottom:5px;">${totalVotes} votes / ${total} total</div>
                    <div class="line-bar-container" style="height:8px; background:#eee; border-radius:4px; overflow:hidden; display:flex;">
                        ${p.candidates.map(c => {
                            const percentage = total > 0 ? (c.votes / total) * 100 : 0;
                            return `<div style="width:${percentage}%; background:${c.party_color}; height:100%;" title="${c.full_name}: ${c.votes} votes"></div>`;
                        }).join('')}
                        ${remaining > 0 ? `<div style="width:${(remaining/total)*100}%; background:#e0e0e0; height:100%;" title="Remaining: ${remaining}"></div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMainDashboard() {
    const main = document.getElementById('analyticsMain');
    
    if(!analyticsData) {
        main.innerHTML = '<p>Loading...</p>';
        return;
    }
    
    const global = analyticsData.global;
    const totalEnrolled = global.total_enrolled || 0;
    const votesCast = global.votes_cast || 0;
    const pending = global.pending || 0;
    
    main.innerHTML = `
        <div style="padding:30px;">
            <h2 style="margin-bottom:30px;">📊 Dashboard Overview</h2>
            
            <div style="background:white; padding:25px; border-radius:12px; margin-bottom:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                <h3 style="margin-bottom:15px;">Total Voter Turnout</h3>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="font-weight:600; color:#28a745;">${votesCast} Voted</span>
                    <span style="color:#999;">${pending} Remaining</span>
                </div>
                <div style="height:30px; background:#e0e0e0; border-radius:8px; overflow:hidden; display:flex;">
                    <div style="width:${totalEnrolled > 0 ? (votesCast/totalEnrolled)*100 : 0}%; background:linear-gradient(90deg, #28a745, #20c997); height:100%;"></div>
                </div>
                <p style="margin-top:10px; color:#666; font-size:0.9em;">${totalEnrolled > 0 ? ((votesCast/totalEnrolled)*100).toFixed(1) : 0}% turnout</p>
            </div>
            
            <div style="background:white; padding:25px; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                <h3 style="margin-bottom:20px;">Party Performance</h3>
                <canvas id="partyBarChart" style="max-height:400px;"></canvas>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        const ctx = document.getElementById('partyBarChart');
        if(ctx && global.parties) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: global.parties.map(p => p.name),
                    datasets: [{
                        label: 'Total Votes',
                        data: global.parties.map(p => p.vote_count || 0),
                        backgroundColor: global.parties.map(p => p.color),
                        borderColor: global.parties.map(p => p.color),
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });
        }
    }, 100);
}function renderPosStat(index) {
    const pos = analyticsData.positions[index];
    const main = document.getElementById('analyticsMain');
    const abstainVotes = pos.abstain_votes || 0;
    
    document.querySelectorAll('#analyticsPosList .nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#analyticsPosList .nav-item')[index].classList.add('active');
    
    const candidateCount = pos.candidates.length;
    const totalVotes = pos.total_votes || 0;
    const remaining = pos.remaining || 0;
    const total = totalVotes + remaining;
    
    // VIEW 1: SINGLE CANDIDATE
    if(candidateCount === 1) {
        const c = pos.candidates[0];
        main.innerHTML = `
            <div style="padding:30px;">
                <h2 style="margin-bottom:20px;">${pos.title}</h2>
                <div style="background:white; padding:30px; border-radius:12px; text-align:center;">
                    <div style="width:100px; height:100px; margin:0 auto 20px; background:${c.party_color}; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:2em;">
                        ${c.photo_url ? `<img src="${c.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
                    </div>
                    <h3 style="font-size:1.8em; margin-bottom:10px;">${c.full_name}</h3>
                    <p style="color:#666; margin-bottom:20px;">${c.party_name}</p>
                    <div style="font-size:3em; font-weight:bold; color:${c.party_color}; margin-bottom:10px;">${c.votes}</div>
                    <p style="color:#999;">Current Votes</p>
                    
                    ${abstainVotes > 0 ? `
                        <div style="margin-top:30px; padding:20px; background:#f9f9f9; border-radius:8px;">
                            <div style="font-size:1.5em; font-weight:bold; color:#95a5a6; margin-bottom:5px;">${abstainVotes}</div>
                            <div style="color:#666;">Abstain Votes</div>
                        </div>
                    ` : ''}

                    <div style="margin-top:30px;">
                        <div style="height:20px; background:#e0e0e0; border-radius:10px; overflow:hidden; display:flex;">
                            <div style="width:${total > 0 ? (c.votes/total)*100 : 0}%; background:${c.party_color};"></div>
                            ${abstainVotes > 0 ? `<div style="width:${total > 0 ? (abstainVotes/total)*100 : 0}%; background:#95a5a6;"></div>` : ''}
                        </div>
                        <p style="margin-top:10px; color:#666;">${remaining} voters remaining</p>
                    </div>
                </div>
            </div>
        `;
    }
    // VIEW 2: TWO CANDIDATES (TUG OF WAR)
    else if(candidateCount === 2) {
        const [c1, c2] = pos.candidates;
        
        // --- LOGIC FOR TUG OF WAR BAR ---
        // We calculate percentages based ONLY on votes cast (ignoring remaining)
        const totalCast = c1.votes + c2.votes + abstainVotes;
        
        let w1 = 50; // Default start (50%)
        let wA = 0;  // Default start (0%)
        let w2 = 50; // Default start (50%)
        
        if (totalCast > 0) {
            w1 = (c1.votes / totalCast) * 100;
            wA = (abstainVotes / totalCast) * 100;
            w2 = (c2.votes / totalCast) * 100;
        }

        main.innerHTML = `
            <div style="padding:30px;">
                <h2 style="margin-bottom:20px;">${pos.title}</h2>
                <div style="background:white; padding:30px; border-radius:12px;">
                    
                    <div style="text-align:center; margin-bottom:15px; color:#666; font-size:0.9em;">
                        <strong>${remaining}</strong> voters remaining / <strong>${total}</strong> total
                    </div>

                    <div style="height:50px; border-radius:25px; overflow:hidden; display:flex; margin-bottom:40px; box-shadow: inset 0 2px 5px rgba(0,0,0,0.1); border: 2px solid #fff;">
                        
                        <div style="width:${w1}%; background:${c1.party_color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; transition: width 0.5s ease; position:relative;">
                             ${w1 > 10 ? `<span style="text-shadow:0 1px 2px rgba(0,0,0,0.3);">${Math.round(w1)}%</span>` : ''}
                        </div>
                        
                        <div style="width:${wA}%; background:#95a5a6; display:flex; align-items:center; justify-content:center; color:white; font-size:0.9em; transition: width 0.5s ease; border-left:1px solid rgba(255,255,255,0.3); border-right:1px solid rgba(255,255,255,0.3);">
                             ${wA > 5 ? '⊘' : ''}
                        </div>

                        <div style="width:${w2}%; background:${c2.party_color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; transition: width 0.5s ease;">
                             ${w2 > 10 ? `<span style="text-shadow:0 1px 2px rgba(0,0,0,0.3);">${Math.round(w2)}%</span>` : ''}
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 0.6fr 1fr; gap:20px; align-items:start;">
                        
                        <div style="text-align:center; padding:25px; border-top:5px solid ${c1.party_color}; border-radius:12px; background: #f8f9fa; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                            <div style="width:90px; height:90px; margin:0 auto 15px; background:${c1.party_color}; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.8em; border: 4px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                                ${c1.photo_url ? `<img src="${c1.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
                            </div>
                            <h3 style="font-size:1.3em; margin-bottom:5px;">${c1.full_name}</h3>
                            <p style="color:#666; margin-bottom:15px; font-weight:bold; color:${c1.party_color}; font-size:0.9em;">${c1.party_name}</p>
                            <div style="font-size:3em; font-weight:bold; color:${c1.party_color}; line-height:1;">${c1.votes}</div>
                            <p style="color:#999; font-size:0.85em; margin-top:5px;">VOTES</p>
                        </div>
                        
                        <div style="text-align:center; padding:20px; border-radius:12px; opacity:0.8; margin-top: 15px;">
                            <div style="width:50px; height:50px; background:#95a5a6; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.5em; margin:0 auto 10px;">⊘</div>
                            <div style="font-size:2em; font-weight:bold; color:#7f8c8d; line-height:1;">${abstainVotes}</div>
                            <p style="color:#aaa; font-size:0.8em; margin-top:5px;">ABSTAINED</p>
                        </div>
                        
                        <div style="text-align:center; padding:25px; border-top:5px solid ${c2.party_color}; border-radius:12px; background: #f8f9fa; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                            <div style="width:90px; height:90px; margin:0 auto 15px; background:${c2.party_color}; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.8em; border: 4px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                                ${c2.photo_url ? `<img src="${c2.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
                            </div>
                            <h3 style="font-size:1.3em; margin-bottom:5px;">${c2.full_name}</h3>
                            <p style="color:#666; margin-bottom:15px; font-weight:bold; color:${c2.party_color}; font-size:0.9em;">${c2.party_name}</p>
                            <div style="font-size:3em; font-weight:bold; color:${c2.party_color}; line-height:1;">${c2.votes}</div>
                            <p style="color:#999; font-size:0.85em; margin-top:5px;">VOTES</p>
                        </div>

                    </div>

                </div>
            </div>
        `;
    }
    // VIEW 3: MULTI-CANDIDATE (3+)
    else {
        main.innerHTML = `
            <div style="padding:30px;">
                <h2 style="margin-bottom:20px;">${pos.title}</h2>
                <div style="background:white; padding:30px; border-radius:12px;">
                    <div style="max-width:500px; margin:0 auto 30px;">
                        <canvas id="pieChart"></canvas>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px;">
                        ${pos.candidates.map(c => `
                            <div style="padding:15px; border-left:4px solid ${c.party_color}; background:#f9f9f9; border-radius:6px;">
                                <div style="font-weight:600; margin-bottom:5px;">${c.full_name}</div>
                                <div style="color:#666; font-size:0.9em; margin-bottom:8px;">${c.party_name}</div>
                                <div style="font-size:1.8em; font-weight:bold; color:${c.party_color};">${c.votes}</div>
                                <div style="color:#999; font-size:0.85em;">${total > 0 ? ((c.votes/total)*100).toFixed(1) : 0}%</div>
                            </div>
                        `).join('')}
                        
                        ${abstainVotes > 0 ? `
                            <div style="padding:15px; border-left:4px solid #95a5a6; background:#f9f9f9; border-radius:6px;">
                                <div style="font-weight:600; margin-bottom:5px;">Abstain</div>
                                <div style="color:#666; font-size:0.9em; margin-bottom:8px;">No Vote Cast</div>
                                <div style="font-size:1.8em; font-weight:bold; color:#95a5a6;">${abstainVotes}</div>
                                <div style="color:#999; font-size:0.85em;">${total > 0 ? ((abstainVotes/total)*100).toFixed(1) : 0}%</div>
                            </div>
                        ` : ''}
                        
                        ${remaining > 0 ? `
                            <div style="padding:15px; border-left:4px solid #e0e0e0; background:#f9f9f9; border-radius:6px;">
                                <div style="font-weight:600; margin-bottom:5px;">Not Yet Voted</div>
                                <div style="color:#666; font-size:0.9em; margin-bottom:8px;">Remaining</div>
                                <div style="font-size:1.8em; font-weight:bold; color:#999;">${remaining}</div>
                                <div style="color:#999; font-size:0.85em;">${total > 0 ? ((remaining/total)*100).toFixed(1) : 0}%</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            const ctx = document.getElementById('pieChart');
            if(ctx) {
                const labels = pos.candidates.map(c => c.full_name);
                const data = pos.candidates.map(c => c.votes);
                const colors = pos.candidates.map(c => c.party_color);
                
                if(abstainVotes > 0) {
                    labels.push('Abstain');
                    data.push(abstainVotes);
                    colors.push('#95a5a6');
                }
                
                if(remaining > 0) {
                    labels.push('Remaining');
                    data.push(remaining);
                    colors.push('#e0e0e0');
                }
                
                new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: colors,
                            borderWidth: 2,
                            borderColor: '#fff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }
        }, 100);
    }
}

// Clean up auto-refresh on page unload
window.addEventListener('beforeunload', () => {
    if(analyticsAutoRefresh) {
        clearInterval(analyticsAutoRefresh);
    }
});

// Generate a hash/fingerprint of the current data to detect changes
function generateDataHash(data) {
    if(!data) return null;
    
    // Create a simple hash from vote counts and totals
    let hash = '';
    hash += data.global.votes_cast + '-';
    hash += data.global.pending + '-';
    
    data.positions.forEach(pos => {
        hash += pos.total_votes + '-';
        hash += pos.abstain_votes + '-';
        pos.candidates.forEach(c => {
            hash += c.votes + '-';
        });
    });
    
    return hash;
}

// === ADD TO BOTTOM OF js/admin.js ===

async function finishElection() {
    if (!confirm("⚠️ FINAL CONFIRMATION ⚠️\n\nAre you sure you want to CLOSE this election?\n\n1. The current database will be SEALED (Read-Only).\n2. No new votes can be accepted.\n3. You will be redirected to the Official Winners Certificate.\n\nThis cannot be undone.")) {
        return;
    }

    const btn = document.getElementById('finishElectionBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Sealing...";
    btn.disabled = true;

    try {
        const res = await fetch('api/seal_election.php', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            btn.innerHTML = "✅ DONE";
            btn.style.background = "#28a745"; 
            setTimeout(() => {
                window.location.href = data.redirect; // Go to certificate page
            }, 1000);
        } else {
            alert("Error: " + data.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        alert("Network Error: " + e.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Global variable to track state
async function renderElectionControl() {
    // 1. Sidebar Active State
    const navElection = document.getElementById('nav-election');
    if (navElection && !navElection.classList.contains('active')) {
        document.querySelectorAll('.col-nav .nav-item').forEach(el => el.classList.remove('active'));
        navElection.classList.add('active');
    }

    const container = document.getElementById('setupDynamicContent');
    
    // Check if panel exists to decide if we need a loading state
    if (!document.getElementById('election-control-panel')) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#999;">Loading Control Room...</div>';
    }

    try {
        const res = await fetch('api/manage_election.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: 'action=get_status'
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const currentStatus = data.status || 'not_started';

        // --- CHECK: Only re-render if status changed OR if the panel is missing ---
        const panelExists = document.getElementById('election-control-panel');
        
        if (currentStatus === lastKnownStatus && panelExists) {
            console.log('📊 Status unchanged. Skipping re-render.');
            return; 
        }

        // Update global tracker
        lastKnownStatus = currentStatus;

        // 2. UI Configuration
        let config = {
            'not_started': { color: '#f39c12', text: 'NOT STARTED', sub: 'Waiting for admin to open lines.' },
            'active':      { color: '#27ae60', text: 'ACTIVE', sub: 'Voting is OPEN. Timestamps enabled.' },
            'paused':      { color: '#c0392b', text: 'PAUSED', sub: 'Submissions are BLOCKED.' },
            'ended':       { color: '#2c3e50', text: 'FINALIZED', sub: 'Election is OVER. Results generated.' }
        }[currentStatus] || { color: '#7f8c8d', text: 'UNKNOWN', sub: '' };

        // 3. Render UI (Clean version without Monitoring Badge)
        container.innerHTML = `
            <div id="election-control-panel" class="col-content" style="grid-column: 2 / 4; background: white; padding: 30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0;">🗳️ Election Control Room</h2>
                    </div>

                <div style="background:${config.color}; color:white; padding:30px; border-radius:12px; text-align:center; box-shadow:0 4px 15px rgba(0,0,0,0.1); margin-bottom:30px;">
                    <div style="font-size:0.9em; opacity:0.9; letter-spacing:1px; text-transform:uppercase;">Current Status</div>
                    <div style="font-size:2.5em; font-weight:bold; margin:5px 0;">${config.text}</div>
                    <div style="font-size:1em; opacity:0.9;">${config.sub}</div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px;">
                    <div style="border:2px solid #27ae60; border-radius:10px; padding:20px; text-align:center; opacity: ${currentStatus === 'ended' ? '0.5' : '1'}">
                        <h3 style="color:#27ae60; margin-bottom:10px;">🟢 Start</h3>
                        <p style="font-size:0.85em; color:#666; margin-bottom:15px;">Open voting lines</p>
                        <button onclick="changeStatus('active')" ${currentStatus === 'ended' ? 'disabled' : ''} style="width:100%; background:#27ae60; color:white; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer;">
                            ${currentStatus === 'active' ? 'RESUME' : 'START'}
                        </button>
                    </div>

                    <div style="border:2px solid #f39c12; border-radius:10px; padding:20px; text-align:center; opacity: ${currentStatus !== 'active' ? '0.5' : '1'}">
                        <h3 style="color:#f39c12; margin-bottom:10px;">⏸️ Pause</h3>
                        <p style="font-size:0.85em; color:#666; margin-bottom:15px;">Block voters</p>
                        <button onclick="changeStatus('paused')" ${currentStatus !== 'active' ? 'disabled' : ''} style="width:100%; background:#f39c12; color:white; border:none; padding:10px; border-radius:6px; font-weight:bold;">
                            PAUSE
                        </button>
                    </div>

                    <div style="border:2px solid #c0392b; border-radius:10px; padding:20px; text-align:center; opacity: ${currentStatus === 'not_started' || currentStatus === 'ended' ? '0.5' : '1'}">
                        <h3 style="color:#c0392b; margin-bottom:10px;">🏁 Finalize</h3>
                        <p style="font-size:0.85em; color:#666; margin-bottom:15px;">Generate Results</p>
                        <button onclick="changeStatus('ended')" ${currentStatus === 'not_started' || currentStatus === 'ended' ? 'disabled' : ''} style="width:100%; background:#c0392b; color:white; border:none; padding:10px; border-radius:6px; font-weight:bold;">
                            FINALIZE
                        </button>
                    </div>
                </div>

                <div style="margin-top:30px; padding:15px; background:#f8f9fa; border-radius:8px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>Public Page:</strong>
                        <span style="color:#666; font-size:0.9em; margin-left:10px;">/election.html</span>
                    </div>
                    <a href="election.html" target="_blank" style="background:#3498db; color:white; text-decoration:none; padding:8px 15px; border-radius:6px; font-size:0.9em; font-weight:bold;">View Page ↗</a>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('❌ Error:', error);
    }
}
async function changeStatus(newStatus) {
    if(!confirm("⚠️ Change election status?\n\nThis will affect all voters immediately.\n\nContinue?")) {
        return;
    }

    // STOP the auto-refresh immediately so it doesn't interfere
    if (window.electionControlRefreshInterval) {
        clearInterval(window.electionControlRefreshInterval);
    }

    // Show loading state on button
    const buttons = document.querySelectorAll('button[onclick^="changeStatus"]');
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    });

    try {
        console.log("🔵 Sending request to update status...");

        const res = await fetch('api/manage_election.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `action=update_status&status=${newStatus}`
        });
        
        const data = await res.json();
        
        // --- 🔍 HERE ARE THE LOGS YOU ARE MISSING ---
        if (data.debug) {
            console.group("🔍 SERVER DEBUG INFO");
            console.log("Action:", data.debug.action);
            console.log("Target File:", data.debug.target_file);
            console.log("Directory Writable?:", data.debug.directory_writable);
            console.log("File Exists?:", data.debug.file_exists);
            console.log("File Writable?:", data.debug.file_writable);
            console.log("Write Status:", data.debug.write_status);
            
            if (data.debug.system_error) {
                console.error("❌ SYSTEM ERROR:", data.debug.system_error);
            }
            console.groupEnd();
        }
        // --------------------------------------------

        if(data.success) {
            // Immediately refresh to show new status
            await renderElectionControl(); 
            
            if(newStatus === 'ended') {
                alert("✅ Election Finalized!\n\nResults have been generated.");
            } else if(newStatus === 'active') {
                alert("✅ Voting is now ACTIVE!");
            } else if(newStatus === 'paused') {
                alert("⏸️ Voting has been PAUSED.");
            }
        } else {
            console.error("Server Error Data:", data);
            throw new Error(data.error || 'Unknown error occurred');
        }
    } catch(error) {
        console.error('❌ Error changing status:', error);
        alert(`❌ Failed to change status\n\nError: ${error.message}\n\nPlease check the console (F12) for details.`);
    } finally {
        // Re-enable buttons regardless of success or failure
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
    }
}