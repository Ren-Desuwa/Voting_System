// Fixed admin.js - Fully functional admin panel with PIN management and ABSTAIN tracking
let positions = [];
let parties = [];
let analyticsData = null;
let currentPartyId = null;
 // For drag-and-drop position reordering

document.addEventListener('DOMContentLoaded', () => {
    loadPositions();
    loadPartyList();
    renderSettingsMode();
});

// ==========================================
// TAB SWITCHING
// ==========================================
function switchMainTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.panel-content').forEach(el => el.style.display = 'none');
    
    if(tab === 'setup') {
        document.querySelector('.nav-tab:first-child').classList.add('active');
        document.getElementById('setupView').style.display = 'grid';
    } else {
        document.querySelector('.nav-tab:last-child').classList.add('active');
        document.getElementById('analyticsView').style.display = 'grid';
        loadDashboard();
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
                <div>
                    <h3>Position Priority Order</h3>
                    <p style="color:#666; font-size:0.9em; margin-bottom:15px;">Drag to reorder ballot positions</p>
                    
                    <div id="positionList" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- Will be populated via loadPositions() -->
                    </div>
                    
                    <div style="margin-top:20px; padding:15px; background:#f0f8ff; border-left:4px solid #3498db; border-radius:6px;">
                        <strong style="color:#2980b9;">💡 Tip:</strong>
                        <p style="margin:8px 0 0 0; color:#666; font-size:0.85em;">The order here determines how positions appear on the ballot. President is typically first.</p>
                    </div>
                </div>

                <!-- COLUMN 3: Data Management -->
                <div>
                    <h3>Data Management</h3>
                    
                    <button type="button" onclick="exportDatabase()" style="width:100%; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; margin-bottom:10px; margin-top:20px;">
                        💾 Export Database
                    </button>
                    
                    <button type="button" onclick="if(confirm('⚠️ WARNING: This will delete ALL votes!\\n\\nAre you absolutely sure?')) resetAllVotes()" style="width:100%; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer; margin-bottom:10px;">
                        🗑️ Reset All Votes
                    </button>
                    
                    <button type="button" onclick="if(confirm('⚠️ DANGER: This will delete EVERYTHING (parties, candidates, votes)!\\n\\nAre you absolutely sure?')) factoryReset()" style="width:100%; padding:12px; background:#c0392b; color:white; border:none; border-radius:6px; cursor:pointer;">
                        ⚠️ Factory Reset
                    </button>
                    
                    <div style="margin-top:20px; padding:15px; background:#fff3cd; border-left:4px solid #ffc107; border-radius:6px;">
                        <strong style="color:#856404;">⚠️ Caution:</strong>
                        <p style="margin:8px 0 0 0; color:#856404; font-size:0.85em;">Reset actions are permanent and cannot be undone. Always export first!</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadPositions();
    checkTailscaleUrl();
}

// ==========================================
// POSITION ORDERING (Drag and Drop)
// ==========================================
async function loadPositions() {
    try {
        const res = await fetch('api/get_positions.php');
        const data = await res.json();
        positions = data.positions || [];
        
        const container = document.getElementById('positionList');
        if(!container) return;
        
        container.innerHTML = positions.map((p, idx) => `
            <div class="position-item" draggable="true" data-position-id="${p.id}" 
                 ondragstart="dragStart(event)" 
                 ondragover="dragOver(event)" 
                 ondrop="drop(event)"
                 style="padding:12px; background:white; border:2px solid #e0e0e0; border-radius:8px; cursor:move; display:flex; align-items:center; gap:10px;">
                <span style="color:#999; font-weight:bold;">${idx + 1}.</span>
                <span style="flex:1;">${p.title}</span>
                <span style="color:#ccc;">☰</span>
            </div>
        `).join('');
    } catch(e) {
        console.error('Failed to load positions:', e);
    }
}

let draggedElement = null;

function dragStart(e) {
    draggedElement = e.target;
    e.target.style.opacity = '0.5';
}

function dragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.position-item');
    if(target && target !== draggedElement) {
        target.style.borderColor = '#667eea';
    }
}

function drop(e) {
    e.preventDefault();
    
    const target = e.target.closest('.position-item');
    if(!target || target === draggedElement) return;
    
    target.style.borderColor = '#e0e0e0';
    
    // Swap elements visually
    const container = target.parentNode;
    const allItems = [...container.children];
    
    const draggedIndex = allItems.indexOf(draggedElement);
    const targetIndex = allItems.indexOf(target);
    
    if(draggedIndex < targetIndex) {
        target.parentNode.insertBefore(draggedElement, target.nextSibling);
    } else {
        target.parentNode.insertBefore(draggedElement, target);
    }
    
    draggedElement.style.opacity = '1';
    
    // Update backend
    savePositionOrder();
}

async function savePositionOrder() {
    const items = document.querySelectorAll('.position-item');
    const orderData = [];
    
    items.forEach((item, index) => {
        orderData.push({
            id: item.getAttribute('data-position-id'),
            priority: index + 1
        });
    });
    
    try {
        await fetch('api/update_position_order.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
    } catch(e) {
        console.error('Failed to save order:', e);
    }
}

// ==========================================
// TAILSCALE URL FEATURE
// ==========================================
async function checkTailscaleUrl() {
    try {
        const res = await fetch('api/get_tailscale_url.php');
        const data = await res.json();
        
        const urlDisplay = document.getElementById('tailscaleUrlDisplay');
        const statusDisplay = document.getElementById('tailscaleStatus');
        
        if(data.success && data.url) {
            urlDisplay.innerHTML = `<strong>${data.url}</strong>`;
            statusDisplay.innerHTML = `✅ Tailscale connected - Accessible remotely`;
            statusDisplay.style.color = '#10b981';
        } else {
            urlDisplay.innerHTML = `<span style="opacity:0.7;">No Tailscale URL detected</span>`;
            statusDisplay.innerHTML = `ℹ️ ${data.message || 'Tailscale not configured'}`;
            statusDisplay.style.color = 'rgba(255,255,255,0.8)';
        }
    } catch(e) {
        console.error('Failed to check Tailscale:', e);
        document.getElementById('tailscaleUrlDisplay').innerHTML = `<span style="opacity:0.7;">Error checking connection</span>`;
        document.getElementById('tailscaleStatus').innerHTML = `❌ Unable to detect Tailscale status`;
    }
}

function copyTailscaleUrl() {
    const urlText = document.getElementById('tailscaleUrlDisplay').innerText;
    
    if(!urlText || urlText.includes('Loading') || urlText.includes('No Tailscale')) {
        alert('No valid URL to copy');
        return;
    }
    
    navigator.clipboard.writeText(urlText).then(() => {
        const btn = document.getElementById('copyUrlBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        btn.style.background = '#10b981';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = 'white';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy: ' + err);
    });
}

// ==========================================
// SETTINGS: Total Voters & PIN Management
// ==========================================
async function saveTotalVoters() {
    const value = document.getElementById('totalVotersInput').value;
    try {
        await fetch('api/settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'total_voters', value })
        });
        alert('Total voters updated successfully!');
    } catch(e) {
        alert('Failed to update total voters: ' + e.message);
    }
}

async function saveDailyPin() {
    const pinValue = document.getElementById('dailyPinInput').value.trim();
    
    if(!pinValue || pinValue.length < 4) {
        alert('❌ PIN must be at least 4 characters long');
        return;
    }
    
    try {
        const res = await fetch('api/settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                key: 'daily_pin', 
                value: pinValue 
            })
        });
        
        const data = await res.json();
        
        if(data.success) {
            alert('✅ Daily PIN updated successfully!\n\nNew PIN: ' + pinValue + '\n\nAll clients will need this PIN to access the voting system.');
        } else {
            alert('❌ Failed to update PIN: ' + (data.message || 'Unknown error'));
        }
    } catch(e) {
        alert('❌ Error updating PIN: ' + e.message);
    }
}

async function viewActiveSessions() {
    try {
        const res = await fetch('api/get_sessions.php');
        const data = await res.json();
        
        if(!data.success || !data.sessions || data.sessions.length === 0) {
            alert('ℹ️ No active sessions found');
            return;
        }
        
        const sessionList = data.sessions.map(s => 
            `IP: ${s.ip_address}\nUser Agent: ${s.user_agent}\nExpires: ${s.expires_at}`
        ).join('\n\n---\n\n');
        
        alert(`Active Sessions (${data.sessions.length}):\n\n${sessionList}`);
    } catch(e) {
        alert('Failed to load sessions: ' + e.message);
    }
}

async function clearAllSessions() {
    if(!confirm('⚠️ This will log out all connected clients. Continue?')) {
        return;
    }
    
    try {
        const res = await fetch('api/clear_sessions.php', { method: 'POST' });
        const data = await res.json();
        
        if(data.success) {
            alert('✅ All sessions cleared. Clients must re-enter PIN.');
        } else {
            alert('❌ Failed to clear sessions: ' + (data.message || 'Unknown error'));
        }
    } catch(e) {
        alert('❌ Error: ' + e.message);
    }
}

// ==========================================
// DATA MANAGEMENT FUNCTIONS
// ==========================================
async function exportDatabase() {
    window.location.href = 'api/export_db.php';
}

async function resetAllVotes() {
    try {
        const res = await fetch('api/reset_votes.php', { method: 'POST' });
        const data = await res.json();
        
        if(data.success) {
            alert('✅ All votes have been reset');
            if(document.getElementById('analyticsView').style.display !== 'none') {
                loadDashboard();
            }
        } else {
            alert('Failed to reset votes: ' + (data.message || 'Unknown error'));
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

async function factoryReset() {
    try {
        const res = await fetch('api/factory_reset.php', { method: 'POST' });
        const data = await res.json();
        
        if(data.success) {
            alert('✅ Factory reset complete. Reloading...');
            location.reload();
        } else {
            alert('Failed to reset: ' + (data.message || 'Unknown error'));
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

// ==========================================
// MODE B: PARTY EDITOR
// ==========================================
function resetPartyForm() {
    document.querySelectorAll('.col-nav .nav-item').forEach(el => el.classList.remove('active'));
    currentPartyId = null;
    
    const container = document.getElementById('setupDynamicContent');
    container.innerHTML = `
        <div class="col-content" style="grid-column: 2 / 3; padding: 30px;">
            <h2>Create New Party</h2>
            <form id="partyForm" onsubmit="saveParty(event)">
                <label>Party Name</label>
                <input type="text" name="name" required placeholder="e.g., SINAG">
                
                <label>Slogan (Optional)</label>
                <input type="text" name="slogan" placeholder="e.g., Lighting the Path Forward">
                
                <label>Brand Color</label>
                <input type="color" name="color" value="#667eea">
                
                <label>Logo/Image URL (Optional)</label>
                <input type="text" name="logo_url" placeholder="assets/party_logo.png">
                
                <button type="submit">Create Party</button>
            </form>
        </div>
        <div class="col-content" style="grid-column: 3 / 4; background: #f9f9f9; padding: 30px;">
            <h3>📝 Instructions</h3>
            <p>1. Enter a unique party name</p>
            <p>2. Add a slogan (optional)</p>
            <p>3. Pick a brand color</p>
            <p>4. Submit to create the party</p>
        </div>
    `;
}

async function loadAndRenderParty(partyName) {
    try {
        const res = await fetch(`api/get_party_full.php?name=${encodeURIComponent(partyName)}`);
        const result = await res.json();
        
        if(!result.success) {
            alert('Failed to load party');
            return;
        }
        
        const party = result.data;
        currentPartyId = party.id;
        
        document.querySelectorAll('.col-nav .nav-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`[data-party-id="${party.id || party.name}"]`)?.classList.add('active');
        
        const container = document.getElementById('setupDynamicContent');
        container.innerHTML = `
            <div class="col-content" style="grid-column: 2 / 3; padding: 30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2>Edit ${party.name}</h2>
                    <button type="button" onclick="if(confirm('Delete this party?')) deleteParty(${party.id})" style="background:#e74c3c; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Delete Party</button>
                </div>
                
                <form id="partyForm" onsubmit="saveParty(event)">
                    <input type="hidden" name="id" value="${party.id}">
                    
                    <label>Party Name</label>
                    <input type="text" name="name" value="${party.name}" required>
                    
                    <label>Slogan</label>
                    <input type="text" name="slogan" value="${party.slogan || ''}">
                    
                    <label>Brand Color</label>
                    <input type="color" name="color" value="${party.color}">
                    
                    <label>Logo URL</label>
                    <input type="text" name="logo_url" value="${party.logo_url || ''}">
                    
                    <button type="submit">Save Changes</button>
                </form>
            </div>
            
            <div class="col-content" style="grid-column: 3 / 4; background: #f9f9f9; padding: 30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3>Candidates</h3>
                    <button onclick="addCandidateRow()" style="background:#27ae60; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">+ Add</button>
                </div>
                
                <div id="candidateList">
                    ${party.candidates && party.candidates.length > 0 
                        ? party.candidates.map(c => renderCandidateRow(c)).join('') 
                        : '<p style="color:#999;">No candidates yet</p>'}
                </div>
            </div>
        `;
        
    } catch(e) {
        alert('Error loading party: ' + e.message);
    }
}

function renderCandidateRow(candidate) {
    return `
        <div class="candidate-row" style="background:white; padding:15px; border-radius:8px; margin-bottom:10px; border:2px solid #e0e0e0;">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                <strong>${candidate.full_name}</strong>
                <button onclick="if(confirm('Delete candidate?')) deleteCandidate(${candidate.id})" style="background:#e74c3c; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.85em;">Delete</button>
            </div>
            <div style="color:#666; font-size:0.9em; margin-bottom:8px;">Position: ${candidate.position_title || 'Unknown'}</div>
            ${candidate.photo_url ? `<div style="color:#999; font-size:0.85em;">Photo: ${candidate.photo_url}</div>` : ''}
        </div>
    `;
}

function addCandidateRow() {
    const list = document.getElementById('candidateList');
    if(list.querySelector('p')) list.innerHTML = ''; // Remove "No candidates" message
    
    const newRow = document.createElement('div');
    newRow.className = 'candidate-row';
    newRow.style.cssText = 'background:white; padding:15px; border-radius:8px; margin-bottom:10px; border:2px solid #667eea;';
    newRow.innerHTML = `
        <form onsubmit="saveCandidate(event, this)" style="display:flex; flex-direction:column; gap:10px;">
            <input type="hidden" name="party_id" value="${currentPartyId}">
            
            <input type="text" name="full_name" placeholder="Full Name" required style="padding:8px; border:1px solid #ddd; border-radius:4px;">
            
            <select name="position_id" required style="padding:8px; border:1px solid #ddd; border-radius:4px;">
                <option value="">Select Position</option>
                ${positions.map(p => `<option value="${p.id}">${p.title}</option>`).join('')}
            </select>
            
            <input type="text" name="photo_url" placeholder="Photo URL (optional)" style="padding:8px; border:1px solid #ddd; border-radius:4px;">
            
            <div style="display:flex; gap:10px;">
                <button type="submit" style="flex:1; background:#27ae60; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">Save</button>
                <button type="button" onclick="this.closest('.candidate-row').remove()" style="background:#95a5a6; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Cancel</button>
            </div>
        </form>
    `;
    
    list.appendChild(newRow);
}

async function saveParty(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const res = await fetch('api/save_party.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if(result.success) {
            alert('Party saved!');
            loadPartyList();
            if(data.id) {
                loadAndRenderParty(data.name);
            } else {
                loadAndRenderParty(result.name || data.name);
            }
        } else {
            alert('Failed to save: ' + (result.message || 'Unknown error'));
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

async function saveCandidate(event, form) {
    event.preventDefault();
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const res = await fetch('api/save_candidate.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if(result.success) {
            alert('Candidate saved!');
            // Reload the current party to refresh the candidate list
            const partyName = parties.find(p => p.id == currentPartyId)?.name;
            if(partyName) loadAndRenderParty(partyName);
        } else {
            alert('Failed to save: ' + (result.message || 'Unknown error'));
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

async function deleteParty(partyId) {
    try {
        const res = await fetch('api/delete_party.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: partyId })
        });
        
        const result = await res.json();
        
        if(result.success) {
            alert('Party deleted');
            loadPartyList();
            resetPartyForm();
        } else {
            alert('Failed: ' + (result.message || 'Unknown error'));
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

async function deleteCandidate(candidateId) {
    try {
        const res = await fetch('api/delete_candidate.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: candidateId })
        });
        
        const result = await res.json();
        
        if(result.success) {
            alert('Candidate deleted');
            const partyName = parties.find(p => p.id == currentPartyId)?.name;
            if(partyName) loadAndRenderParty(partyName);
        } else {
            alert('Failed: ' + (result.message || 'Unknown error'));
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

// ==========================================
// ANALYTICS TAB
// ==========================================
async function loadDashboard() {
    try {
        const res = await fetch('api/get_stats_full.php');
        const data = await res.json();
        
        if(!data.success) {
            alert('Failed to load analytics');
            return;
        }
        
        analyticsData = data;
        
        const navContainer = document.getElementById('analyticsPosList');
        navContainer.innerHTML = data.positions.map(p => `
            <div class="nav-item" onclick="renderPositionAnalytics(${p.id})">
                ${p.title}
            </div>
        `).join('');
        
        renderMainDashboard();
        
    } catch(e) {
        console.error('Failed to load dashboard:', e);
        alert('Error loading analytics');
    }
}

function renderMainDashboard() {
    if(!analyticsData) return;
    
    document.querySelectorAll('#analyticsView .nav-item').forEach(el => el.classList.remove('active'));
    
    const g = analyticsData.global;
    const main = document.getElementById('analyticsMain');
    
    main.innerHTML = `
        <div style="padding:30px;">
            <h2 style="margin-bottom:30px;">📊 Election Overview</h2>
            
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:20px; margin-bottom:40px;">
                <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:25px; border-radius:12px; box-shadow:0 4px 15px rgba(102,126,234,0.3);">
                    <div style="font-size:0.9em; opacity:0.9; margin-bottom:10px;">Total Enrolled</div>
                    <div style="font-size:3em; font-weight:bold;">${g.total_enrolled}</div>
                </div>
                
                <div style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color:white; padding:25px; border-radius:12px; box-shadow:0 4px 15px rgba(245,87,108,0.3);">
                    <div style="font-size:0.9em; opacity:0.9; margin-bottom:10px;">Votes Cast</div>
                    <div style="font-size:3em; font-weight:bold;">${g.votes_cast}</div>
                    <div style="font-size:0.85em; opacity:0.8; margin-top:5px;">${g.total_enrolled > 0 ? ((g.votes_cast/g.total_enrolled)*100).toFixed(1) : 0}% turnout</div>
                </div>
                
                <div style="background:linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color:white; padding:25px; border-radius:12px; box-shadow:0 4px 15px rgba(79,172,254,0.3);">
                    <div style="font-size:0.9em; opacity:0.9; margin-bottom:10px;">Pending</div>
                    <div style="font-size:3em; font-weight:bold;">${g.pending}</div>
                    <div style="font-size:0.85em; opacity:0.8; margin-top:5px;">${g.total_enrolled > 0 ? ((g.pending/g.total_enrolled)*100).toFixed(1) : 0}% remaining</div>
                </div>
            </div>
            
            <div style="background:white; padding:30px; border-radius:12px; margin-bottom:30px;">
                <h3 style="margin-bottom:20px;">Party Performance</h3>
                <div style="max-width:600px; margin:0 auto;">
                    <canvas id="partyChart"></canvas>
                </div>
            </div>
            
            <div style="background:white; padding:30px; border-radius:12px;">
                <h3 style="margin-bottom:20px;">Position-by-Position Summary</h3>
                <div style="display:grid; gap:15px;">
                    ${analyticsData.positions.map(pos => {
                        const total = g.total_enrolled;
                        const voted = pos.total_votes;
                        const abstain = pos.abstain_votes || 0;
                        const remaining = pos.remaining;
                        const candidateVotes = voted - abstain;
                        
                        return `
                            <div style="padding:20px; border:2px solid #e0e0e0; border-radius:10px; cursor:pointer; transition:all 0.3s;" 
                                 onclick="renderPositionAnalytics(${pos.id})"
                                 onmouseover="this.style.borderColor='#667eea'; this.style.background='#f8f9ff';"
                                 onmouseout="this.style.borderColor='#e0e0e0'; this.style.background='white';">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                                    <h4 style="margin:0; color:#667eea;">${pos.title}</h4>
                                    <div style="text-align:right;">
                                        <div style="font-size:1.5em; font-weight:bold; color:#333;">${voted}</div>
                                        <div style="font-size:0.85em; color:#999;">votes cast</div>
                                    </div>
                                </div>
                                <div style="height:30px; background:#e0e0e0; border-radius:8px; overflow:hidden; display:flex;">
                                    <div style="width:${total > 0 ? (candidateVotes/total)*100 : 0}%; background:linear-gradient(90deg, #667eea 0%, #764ba2 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:0.85em; font-weight:600;">
                                        ${candidateVotes > 0 ? candidateVotes : ''}
                                    </div>
                                    ${abstain > 0 ? `
                                        <div style="width:${total > 0 ? (abstain/total)*100 : 0}%; background:#95a5a6; display:flex; align-items:center; justify-content:center; color:white; font-size:0.85em; font-weight:600;">
                                            ${abstain} Abstain
                                        </div>
                                    ` : ''}
                                    <div style="width:${total > 0 ? (remaining/total)*100 : 0}%; background:#f0f0f0; display:flex; align-items:center; justify-content:center; color:#999; font-size:0.85em;">
                                        ${remaining > 0 ? remaining + ' left' : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        const ctx = document.getElementById('partyChart');
        if(ctx && g.parties) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: g.parties.map(p => p.name),
                    datasets: [{
                        label: 'Total Votes',
                        data: g.parties.map(p => p.vote_count),
                        backgroundColor: g.parties.map(p => p.color),
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }, 100);
}

function renderPositionAnalytics(positionId) {
    if(!analyticsData) return;
    
    const pos = analyticsData.positions.find(p => p.id == positionId);
    if(!pos) return;
    
    document.querySelectorAll('#analyticsView .nav-item').forEach(el => el.classList.remove('active'));
    event?.target?.classList.add('active');
    
    const main = document.getElementById('analyticsMain');
    const total = analyticsData.global.total_enrolled;
    const remaining = pos.remaining;
    const abstainVotes = pos.abstain_votes || 0;
    const candidateCount = pos.candidates.length;
    
    // CASE 1: Only 1 candidate (Unopposed)
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
    // CASE 2: 2 candidates (Head to Head)
    else if(candidateCount === 2) {
        const [c1, c2] = pos.candidates;
        main.innerHTML = `
            <div style="padding:30px;">
                <h2 style="margin-bottom:20px;">${pos.title}</h2>
                <div style="background:white; padding:30px; border-radius:12px;">
                    <div style="height:40px; border-radius:10px; overflow:hidden; display:flex; margin-bottom:30px;">
                        <div style="width:${total > 0 ? (c1.votes/total)*100 : 0}%; background:${c1.party_color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">
                            ${c1.votes}
                        </div>
                        ${abstainVotes > 0 ? `
                            <div style="width:${total > 0 ? (abstainVotes/total)*100 : 0}%; background:#95a5a6; display:flex; align-items:center; justify-content:center; color:white; font-size:0.9em;">
                                ${abstainVotes} Abstain
                            </div>
                        ` : ''}
                        <div style="width:${total > 0 ? (remaining/total)*100 : 0}%; background:#e0e0e0; display:flex; align-items:center; justify-content:center; color:#666; font-size:0.9em;">
                            ${remaining} left
                        </div>
                        <div style="width:${total > 0 ? (c2.votes/total)*100 : 0}%; background:${c2.party_color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">
                            ${c2.votes}
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px;">
                        <div style="text-align:center; padding:20px; border:2px solid ${c1.party_color}; border-radius:10px;">
                            <div style="width:80px; height:80px; margin:0 auto 15px; background:${c1.party_color}; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.8em;">
                                ${c1.photo_url ? `<img src="${c1.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
                            </div>
                            <h3 style="font-size:1.3em; margin-bottom:5px;">${c1.full_name}</h3>
                            <p style="color:#666; margin-bottom:10px;">${c1.party_name}</p>
                            <div style="font-size:2.5em; font-weight:bold; color:${c1.party_color};">${c1.votes}</div>
                            <p style="color:#999; font-size:0.9em;">${total > 0 ? ((c1.votes/total)*100).toFixed(1) : 0}%</p>
                        </div>
                        
                        <div style="text-align:center; padding:20px; border:2px solid ${c2.party_color}; border-radius:10px;">
                            <div style="width:80px; height:80px; margin:0 auto 15px; background:${c2.party_color}; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.8em;">
                                ${c2.photo_url ? `<img src="${c2.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : '👤'}
                            </div>
                            <h3 style="font-size:1.3em; margin-bottom:5px;">${c2.full_name}</h3>
                            <p style="color:#666; margin-bottom:10px;">${c2.party_name}</p>
                            <div style="font-size:2.5em; font-weight:bold; color:${c2.party_color};">${c2.votes}</div>
                            <p style="color:#999; font-size:0.9em;">${total > 0 ? ((c2.votes/total)*100).toFixed(1) : 0}%</p>
                        </div>
                    </div>
                    
                    ${abstainVotes > 0 ? `
                        <div style="margin-top:30px; padding:20px; background:#f9f9f9; border-radius:8px; text-align:center;">
                            <div style="font-size:1.5em; font-weight:bold; color:#95a5a6; margin-bottom:5px;">${abstainVotes}</div>
                            <div style="color:#666;">Abstain Votes (${total > 0 ? ((abstainVotes/total)*100).toFixed(1) : 0}%)</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    // CASE 3: Multiple candidates (3+)
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
                
                // Add abstain to chart if present
                if(abstainVotes > 0) {
                    labels.push('Abstain');
                    data.push(abstainVotes);
                    colors.push('#95a5a6');
                }
                
                // Add remaining to chart if present
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