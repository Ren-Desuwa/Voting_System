// js/script.js
// 1. DYNAMIC DATA CONTAINERS
let positionNames = {};
let candidates = {};
let positionKeys = []; 
let votes = {};        
let currentStep = 1;   

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    loadBallot(); 
});

// 3. FETCH DATA FROM SERVER
async function loadBallot() {
    try {
        console.log("Fetching election data...");
        const res = await fetch('api/get_ballot.php');
        const data = await res.json();

        positionNames = data.positionNames;
        candidates = data.candidates;
        positionKeys = Object.keys(positionNames);
        
        votes = {};
        positionKeys.forEach(key => votes[key] = null);
        
        console.log("Ballot loaded successfully:", positionNames);
    } catch (e) {
        console.error("Failed to load ballot:", e);
        alert("Error connecting to server. Please ensure the database is running.");
    }
}

// 4. CORE NAVIGATION FUNCTIONS
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

async function startVoting() {
    // 1. UI Check
    if (positionKeys.length === 0) {
        alert("Election data is still loading...");
        return;
    }

    // --- FIX 1: MATCH THE KEY USED IN AUTH.JS ---
    const token = localStorage.getItem('election_session_token'); 

    try {
        // 2. Validate Session and Status in parallel
        const [statusRes, sessionRes] = await Promise.all([
            fetch('api/manage_election.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'action=get_status'
            }),
            fetch('api/session_check.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ token: token })
            })
        ]);

        const statusData = await statusRes.json();
        const sessionData = await sessionRes.json();

        // 3. Logic Gate
        if (statusData.status !== 'active') {
            // --- FIX 2: ALERT ONLY, DO NOT REDIRECT ---
            alert("⚠️ Voting Unavailable\n\nCurrent Status: " + (statusData.status || 'Offline').toUpperCase() + "\n\nPlease wait for the admin to open voting.");
            // window.location.href = 'election.html'; // REMOVED
            return;
        }

        if (!sessionData.valid) {
            alert("⚠️ Security Alert: Session is no longer valid. The PIN may have changed.");
            location.reload(); // Reloads to show PIN screen again
            return;
        }

        // 4. Proceed to voting UI if both pass
        document.getElementById('pageHome').classList.remove('active');
        document.getElementById('votingUI').style.display = 'block';
        document.getElementById('votingPage').classList.add('active');
        renderCandidates();
        updateUI();

    } catch (e) {
        console.error("Auth check failed", e);
        alert("System Error: Could not verify election status.");
    }
}

function showVotingPage() {
    showPage('votingPage');
    renderCandidates();
    updateUI();
}

// Helper: Shuffle Array (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 5. RENDER UI
function renderCandidates() {
    const key = positionKeys[currentStep - 1]; 
    const grid = document.getElementById('candidatesGrid');
    
    document.getElementById('displayPositionTitle').innerText = positionNames[key];
    document.getElementById('displayPositionSubtitle').innerText = `Select one candidate for ${positionNames[key]}`;
    
    grid.innerHTML = '';
    
    if (candidates[key]) {
        candidates[key].forEach((candidate, index) => {
            const isSelected = votes[key] === index ? 'selected' : '';
            const card = document.createElement('div');
            card.className = `candidate-card ${isSelected}`;
            card.onclick = () => selectCandidate(index, key);

            const photoContent = candidate.img 
                ? `<img src="${candidate.img}" alt="${candidate.name}" onerror="this.onerror=null;this.src='assets/CZSHS_logo.png';">`
                : `👤`;

            card.innerHTML = `
                <div class="candidate-photo">
                    ${photoContent}
                </div>
                <div class="candidate-info">
                    <div class="candidate-name">${candidate.name}</div>
                    <div class="candidate-party">${candidate.party || 'Independent'}</div>
                </div>
                <div class="candidate-radio"></div>
            `;
            grid.appendChild(card);
        });
    }
    
    const abstainBtn = document.getElementById('abstainBtn');
    if (abstainBtn) {
        if (votes[key] === 'abstain') {
            abstainBtn.classList.add('selected');
        } else {
            abstainBtn.classList.remove('selected');
        }
    }
}

function selectCandidate(index, key) {
    votes[key] = index;
    
    const abstainBtn = document.getElementById('abstainBtn');
    if (abstainBtn) {
        abstainBtn.classList.remove('selected');
    }
    
    const cards = document.querySelectorAll('.candidate-card');
    cards.forEach((card, i) => {
        if (i === index) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    updateUI(); 
}

function selectAbstain() {
    const currentKey = positionKeys[currentStep - 1];
    votes[currentKey] = 'abstain';
    
    const cards = document.querySelectorAll('.candidate-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    const abstainBtn = document.getElementById('abstainBtn');
    abstainBtn.classList.add('selected');
    
    updateUI();
}

function updateUI() {
    const currentKey = positionKeys[currentStep - 1];
    const nextBtn = document.getElementById('nextBtn');
    
    if (votes[currentKey] !== null) {
        nextBtn.disabled = false;
    } else {
        nextBtn.disabled = true;
    }

    const totalSteps = positionKeys.length;
    document.getElementById('pageIndicator').innerText = `Step ${currentStep} of ${totalSteps}`;
    const progress = (currentStep / (totalSteps + 1)) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;

    nextBtn.innerText = currentStep === totalSteps ? "Review Votes →" : "Next →";
}

function handleNext() {
    const totalSteps = positionKeys.length;
    if (currentStep < totalSteps) {
        currentStep++;
        showVotingPage();
    } else {
        showSummary();
    }
}

function handlePrevious() {
    if (currentStep > 1) {
        currentStep--;
        showVotingPage();
    } else {
        if(confirm("Cancel voting and return to home screen?")) {
            location.reload();
        }
    }
}

function showSummary() {
    const content = document.getElementById('summaryContent');
    content.innerHTML = '';
    
    positionKeys.forEach(key => {
        const selection = votes[key];
        
        if (selection === 'abstain') {
            const item = document.createElement('div');
            item.className = 'summary-item';
            item.innerHTML = `
                <div class="summary-position">${positionNames[key]}</div>
                <div class="summary-candidate-photo">⊘</div>
                <div class="summary-candidate">Abstained</div>
                <div class="summary-party">No vote cast for this position</div>
            `;
            content.appendChild(item);
        } else {
            const candidate = candidates[key][selection];
            const photoContent = candidate.img 
                ? `<img src="${candidate.img}" alt="${candidate.name}" onerror="this.onerror=null;this.src='assets/CZSHS_logo.png';">`
                : `👤`;
            
            const item = document.createElement('div');
            item.className = 'summary-item';
            item.innerHTML = `
                <div class="summary-position">${positionNames[key]}</div>
                <div class="summary-candidate-photo">${photoContent}</div>
                <div class="summary-candidate">${candidate.name}</div>
                <div class="summary-party">${candidate.party || 'Independent'}</div>
            `;
            content.appendChild(item);
        }
    });

    document.getElementById('progressFill').style.width = `100%`;
    showPage('pageSummary');
}

async function submitVote() {
    const submitBtn = document.querySelector('#pageSummary .btn-primary');
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitting...";

    // 1. GET TOKEN
    const token = localStorage.getItem('election_session_token');
    if (!token) {
        alert("Session Error: You are not logged in.");
        location.reload();
        return;
    }

    // 2. CONSTRUCT PAYLOAD (Token + Votes Wrapper)
    const payload = {
        token: token,
        votes: {}
    };

    positionKeys.forEach(key => {
        const selection = votes[key];
        if (selection === 'abstain') {
            payload.votes[key] = 'abstain';
        } else if (selection !== null && candidates[key] && candidates[key][selection]) {
            payload.votes[key] = candidates[key][selection].id;
        }
    });

    try {
        const res = await fetch('api/submit_vote.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        
        if(result.success) {
            document.getElementById('votingUI').style.display = 'none';
            showPage('pageSuccess');
            
            // // Clear session to prevent re-voting
            // localStorage.removeItem('election_session_token');
            
            setTimeout(() => {
                location.reload();
            }, 3000);
        } else {
            throw new Error(result.message || "Server rejected vote");
        }
    } catch (err) {
        console.error(err);
        alert("Submission Failed: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit Vote ✓";
    }
}