

// 1. DATA CONFIGURATION
const positionNames = {
    g11: "Grade 11 Representative",
    g12: "Grade 12 Representative",
    treasurer: "Treasurer",
    secretary: "Secretary",
    vp: "Vice President",
    president: "President"
};

const candidates = {
    g11: [
        { name: "Juan Dela Cruz", party: "Team Payaman", img: "assets/Sample69.jpg" }, 
        { name: "Maria Clara", party: "Team Bakulaw", img: "assets/Sample1.jpg" },
        { name: "Angelo Reyes", party: "Team Agila", img: "assets/Sample2.jpg" }
    ],
    g12: [
        { name: "Jose Rizal", party: "Team HotDog", img: "assets/Sample3.jpg" }, 
        { name: "Andres Bonifacio", party: "Geng Geng", img: "assets/Sample4.jpg" },
        { name: "Emilio Aguinaldo", party: "Team Agila", img: "assets/Sample5.jpg" }
    ],
    treasurer: [
        { name: "Robert Martinez", party: "Team Payaman", img: "assets/Sample6.jpg" }, 
        { name: "Jennifer Lee", party: "Team Bakulaw", img: "assets/Sample7.jpg" },
        { name: "Ricardo Dalisay", party: "Team Agila", img: "assets/Sample8.jpg" }
    ],
    secretary: [
        { name: "Emily Rodriguez", party: "Team Payaman", img: "assets/Sample9.jpg" }, 
        { name: "David Wilson", party: "Team Bakulaw", img: "assets/Sample10.jpg" },
        { name: "Bea Alonzo", party: "Team Agila", img: "assets/Sample11.jpg" }
    ],
    vp: [
        { name: "Amanda Taylor", party: "Team Payaman", img: "assets/Sample12.jpg" }, 
        { name: "Christopher Davis", party: "Team Bakulaw", img: "assets/Sample13.jpg" },
        { name: "Dingdong Dantes", party: "Team Agila", img: "assets/Sample14.jpg" }
    ],
    president: [
        { name: "James Thompson", party: "Team Payaman", img: "assets/Sample15.jpg" }, 
        { name: "Margaret Williams", party: "Team Bakulaw", img: "assets/Sample16.jpg" },
        { name: "Vic Sotto", party: "Team Agila", img: "assets/Sample17.jpg" }
    ]
};

// 2. STATE MANAGEMENT
let currentStep = 0; // 0 = Home, 1 to N = Voting, N+1 = Summary
const positionKeys = Object.keys(positionNames);
const totalVotingSteps = positionKeys.length;
const votes = {}; 

// Initialize votes object with nulls
positionKeys.forEach(key => votes[key] = null);

// 3. CORE FUNCTIONS
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function startVoting() {
    currentStep = 1;
    // Shuffle candidates for every position once before starting
    Object.keys(candidates).forEach(key => {
        shuffleArray(candidates[key]);
    });
    document.getElementById('votingUI').style.display = 'block';
    showVotingPage();
}

function showVotingPage() {
    showPage('votingPage');
    renderCandidates();
    updateUI();
}

// Helper function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function renderCandidates() {
    const key = positionKeys[currentStep - 1];
    const grid = document.getElementById('candidatesGrid');
    
    document.getElementById('displayPositionTitle').innerText = positionNames[key];
    document.getElementById('displayPositionSubtitle').innerText = `Select one candidate for ${positionNames[key]}`;
    
    grid.innerHTML = '';
    
    candidates[key].forEach((candidate, index) => {
        const isSelected = votes[key] === index ? 'selected' : '';
        const card = document.createElement('div');
        card.className = `candidate-card ${isSelected}`;
        card.onclick = () => selectCandidate(index, key);

        // Check if candidate has an image; otherwise, use the emoji placeholder
        const photoContent = candidate.img 
            ? `<img src="${candidate.img}" alt="${candidate.name}" onerror="this.onerror=null;this.src='assets/CZSHS_logo.png';">`
            : `👤`;

        card.innerHTML = `
            <div class="candidate-photo">
                ${photoContent}
            </div>
            <div class="candidate-info">
                <div class="candidate-name">${candidate.name}</div>
                <div class="candidate-party">${candidate.party}</div>
            </div>
            <div class="candidate-radio"></div>
        `;
        grid.appendChild(card);
    });
}

function selectCandidate(index, key) {
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
    
    // Check if the current position has a selection
    // Using !== null is safer than if(votes[currentKey]) because index 0 is "falsy"
    if (votes[currentKey] !== null) {
        nextBtn.disabled = false;
    } else {
        nextBtn.disabled = true;
    }

    // Dynamic Page Numbering
    document.getElementById('pageIndicator').innerText = `Step ${currentStep} of ${totalVotingSteps}`;
    
    // Dynamic Progress Bar
    const progress = (currentStep / (totalVotingSteps + 1)) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;

    // Dynamic Button Labels
    nextBtn.innerText = currentStep === totalVotingSteps ? "Review Votes →" : "Next →";
}

function handleNext() {
    if (currentStep < totalVotingSteps) {
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
        location.reload();
    }
}

function showSummary() {
    const content = document.getElementById('summaryContent');
    content.innerHTML = '';
    
    positionKeys.forEach(key => {
        const candidate = candidates[key][votes[key]];
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = `
            <div class="summary-position">${positionNames[key]}</div>
            <div class="summary-candidate">${candidate.name}</div>
            <div class="summary-party">${candidate.party}</div>
        `;
        content.appendChild(item);
    });

    const progress = 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    showPage('pageSummary');
}

function submitVote() {
    document.getElementById('votingUI').style.display = 'none';
    showPage('pageSuccess');
    console.log("Final Votes:", votes);
}

        /* ==================================================================
FUTURE PHP DATABASE INTEGRATION (PLACEHOLDERS)
==================================================================
The functions below are designed to work with a PHP backend.
Uncomment these when you are ready to move from localStorage 
to a real SQL database.
*/

/**
 * Sends a single vote to a PHP script (e.g., submit_vote.php)
 * @param {Object} userVotes - The current 'votes' object containing selections
 */
/*
async function submitToDatabase(userVotes) {
    try {
        const response = await fetch('api/submit_vote.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userVotes)
        });
        
        const result = await response.json();
        if (result.success) {
            console.log("Database updated successfully");
        } else {
            console.error("Database error:", result.message);
        }
    } catch (error) {
        console.error("Network error:", error);
    }
}
*/

/**
 * Fetches real-time statistics from a PHP script (e.g., get_results.php)
 */
/*
async function fetchStatisticsFromDB() {
    try {
        const response = await fetch('api/get_results.php');
        const dbData = await response.json();
        
        // This would replace your local 'voteStorage' with real server data
        voteStorage = dbData; 
        displayStatistics();
    } catch (error) {
        console.error("Could not fetch database stats:", error);
    }
}
*/

/**
 * Securely verifies admin credentials via backend PHP
 */
/*
async function verifyAdminWithDB(username, password) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
        const response = await fetch('api/admin_login.php', {
            method: 'POST',
            body: formData
        });
        const status = await response.json();
        return status.authorized; // Returns true or false
    } catch (error) {
        console.error("Auth error:", error);
        return false;
    }
}
*/