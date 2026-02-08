

// js/script.js
// 1. DYNAMIC DATA CONTAINERS
let positionNames = {};
let candidates = {};
let positionKeys = []; // ["pos_1", "pos_2", etc.]
let votes = {};        // Stores the user's choices: { "pos_1": 2, "pos_2": 0 }
let currentStep = 0;   // 0 = Home, 1+ = Voting

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    loadBallot(); // Fetch data immediately in the background
});

// 3. FETCH DATA FROM SERVER
async function loadBallot() {
    try {
        console.log("Fetching election data...");
        const res = await fetch('api/get_ballot.php');
        const data = await res.json();

        // Save data to global variables
        positionNames = data.positionNames;
        candidates = data.candidates;
        positionKeys = Object.keys(positionNames);
        
        // Initialize votes object with nulls
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

function startVoting() {
    // Check if data is loaded
    if (positionKeys.length === 0) {
        alert("Election data is still loading... please try again in a few seconds.");
        loadBallot(); // Retry loading
        return;
    }
    
    // Reset selections for the new voter
    positionKeys.forEach(key => votes[key] = null);
    
    // Start at Step 1
    currentStep = 1;
    document.getElementById('votingUI').style.display = 'block';
    
    // Shuffle candidates once per voter session (Optional fairness)
    positionKeys.forEach(key => {
        if(candidates[key]) {
            shuffleArray(candidates[key]);
        }
    });

    showVotingPage();
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
    const key = positionKeys[currentStep - 1]; // e.g., "pos_1"
    const grid = document.getElementById('candidatesGrid');
    
    // Update Header
    document.getElementById('displayPositionTitle').innerText = positionNames[key];
    document.getElementById('displayPositionSubtitle').innerText = `Select one candidate for ${positionNames[key]}`;
    
    grid.innerHTML = '';
    
    // Create Cards
    if (candidates[key]) {
        candidates[key].forEach((candidate, index) => {
            const isSelected = votes[key] === index ? 'selected' : '';
            const card = document.createElement('div');
            card.className = `candidate-card ${isSelected}`;
            card.onclick = () => selectCandidate(index, key);

            // Handle Image (Use placeholder if empty)
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
}

function selectCandidate(index, key) {
    // votes[key] = index; // Store the array index of the selected candidate
    // renderCandidates(); // Re-render to show selection highlight
    // updateUI();         // Update "Next" button state

    votes[key] = index;
    
    // Find all cards in the grid
    const cards = document.querySelectorAll('.candidate-card');
    
    // Simply toggle the 'selected' class on the existing HTML elements
    cards.forEach((card, i) => {
        if (i === index) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    updateUI(); 
}

function updateUI() {
    const currentKey = positionKeys[currentStep - 1];
    const nextBtn = document.getElementById('nextBtn');
    
    // Enable "Next" only if a selection is made
    if (votes[currentKey] !== null) {
        nextBtn.disabled = false;
    } else {
        nextBtn.disabled = true;
    }

    // Progress Bar & Page Numbers
    const totalSteps = positionKeys.length;
    document.getElementById('pageIndicator').innerText = `Step ${currentStep} of ${totalSteps}`;
    const progress = (currentStep / (totalSteps + 1)) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;

    // Button Text (Last step says "Review")
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
        // Confirm before quitting
        if(confirm("Cancel voting and return to home screen?")) {
            location.reload();
        }
    }
}

function showSummary() {
    const content = document.getElementById('summaryContent');
    content.innerHTML = '';
    
    positionKeys.forEach(key => {
        const index = votes[key];
        const candidate = candidates[key][index];
        
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = `
            <div class="summary-position">${positionNames[key]}</div>
            <div class="summary-candidate">${candidate.name}</div>
            <div class="summary-party">${candidate.party || 'Independent'}</div>
        `;
        content.appendChild(item);
    });

    document.getElementById('progressFill').style.width = `100%`;
    showPage('pageSummary');
}

// 6. SUBMIT TO SERVER
async function submitVote() {
    const submitBtn = document.querySelector('#pageSummary .btn-primary');
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitting...";

    // Prepare payload: Map the selection index back to the database ID
    const payload = {};
    positionKeys.forEach(key => {
        const index = votes[key];
        if (index !== null) {
            // Get the actual Database ID from the candidate object
            payload[key] = candidates[key][index].id;
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
            
            // AUTO-RESET after 3 seconds for the next voter
            console.log("Resetting in 3 seconds...");
            setTimeout(() => {
                location.reload();
            }, 3000);
        } else {
            alert("Error submitting vote: " + result.message);
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit Vote ✓";
        }
    } catch (err) {
        console.error(err);
        alert("Network Error. Please try again.");
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit Vote ✓";
    }
}