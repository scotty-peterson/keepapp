// Keep Up App - Stay connected with the people who matter
// Now with Supabase cloud storage!

// Supabase configuration
const SUPABASE_URL = 'https://qcgqyleqyrcspbtiqxlh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjZ3F5bGVxeXJjc3BidGlxeGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDc2MzIsImV4cCI6MjA4NTEyMzYzMn0._C3HLm9MxabfwTqF6zMfw9pm5gyz2jFfYjCNM0dt-jE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get or create a unique user ID for this browser
function getUserId() {
    let userId = localStorage.getItem('keepup_user_id');
    if (!userId) {
        userId = 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        localStorage.setItem('keepup_user_id', userId);
    }
    return userId;
}

const USER_ID = getUserId();

// Utility functions
const Utils = {
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    daysSince: (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return Math.floor((today - date) / (1000 * 60 * 60 * 24));
    },

    daysUntil: (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return Math.floor((date - today) / (1000 * 60 * 60 * 24));
    }
};

// App state
let currentPersonForModal = null;
let currentCommitmentFilter = 'pending';
let peopleCache = [];
let commitmentsCache = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initForms();
    initModal();
    initFilters();

    // Load data from Supabase
    await loadData();
});

// Load all data from Supabase
async function loadData() {
    await Promise.all([loadPeople(), loadCommitments()]);
    renderPeople();
    renderCommitments();
    updatePersonDropdown();
}

// Load people from Supabase
async function loadPeople() {
    const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('user_id', USER_ID)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading people:', error);
        return;
    }
    peopleCache = data || [];
}

// Load commitments from Supabase
async function loadCommitments() {
    const { data, error } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', USER_ID)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error loading commitments:', error);
        return;
    }
    commitmentsCache = data || [];
}

// Tab switching
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Form handling
function initForms() {
    // Add person form
    document.getElementById('add-person-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('person-name').value.trim();
        const frequency = parseInt(document.getElementById('person-frequency').value);
        const notes = document.getElementById('person-notes').value.trim();

        if (!name || !frequency) return;

        const { data, error } = await supabase
            .from('people')
            .insert({
                user_id: USER_ID,
                name,
                frequency,
                notes: notes || null,
                last_contact: new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding person:', error);
            alert('Error adding person. Please try again.');
            return;
        }

        peopleCache.unshift(data);
        e.target.reset();
        renderPeople();
        updatePersonDropdown();
    });

    // Add commitment form
    document.getElementById('add-commitment-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const personId = document.getElementById('commitment-person').value;
        const dueDate = document.getElementById('commitment-due').value;
        const text = document.getElementById('commitment-text').value.trim();

        if (!personId || !dueDate || !text) return;

        const { data, error } = await supabase
            .from('commitments')
            .insert({
                user_id: USER_ID,
                person_id: personId,
                text,
                due_date: dueDate,
                completed: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding commitment:', error);
            alert('Error adding commitment. Please try again.');
            return;
        }

        commitmentsCache.push(data);
        e.target.reset();
        renderCommitments();
    });

    // Sort people
    document.getElementById('sort-people').addEventListener('change', renderPeople);
}

// Modal handling
function initModal() {
    const modal = document.getElementById('reach-out-modal');

    document.getElementById('cancel-reach-out').addEventListener('click', () => {
        modal.classList.remove('active');
        currentPersonForModal = null;
    });

    document.getElementById('confirm-reach-out').addEventListener('click', async () => {
        if (!currentPersonForModal) return;

        const today = new Date().toISOString().split('T')[0];

        const { error } = await supabase
            .from('people')
            .update({ last_contact: today })
            .eq('id', currentPersonForModal);

        if (error) {
            console.error('Error updating contact:', error);
            alert('Error logging reach out. Please try again.');
            return;
        }

        // Update cache
        const person = peopleCache.find(p => p.id === currentPersonForModal);
        if (person) {
            person.last_contact = today;
        }

        modal.classList.remove('active');
        currentPersonForModal = null;
        renderPeople();
    });

    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            currentPersonForModal = null;
        }
    });
}

// Filter handling
function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCommitmentFilter = btn.dataset.filter;
            renderCommitments();
        });
    });
}

// Render people list
function renderPeople() {
    const peopleList = document.getElementById('people-list');
    const sortBy = document.getElementById('sort-people').value;

    document.getElementById('people-count').textContent = peopleCache.length;

    if (peopleCache.length === 0) {
        peopleList.innerHTML = '<p class="empty-state">No people added yet. Add someone above to get started!</p>';
        return;
    }

    // Calculate days overdue for each person
    const peopleWithStatus = peopleCache.map(person => {
        const daysSinceContact = Utils.daysSince(person.last_contact);
        const daysOverdue = daysSinceContact - person.frequency;
        return { ...person, daysSinceContact, daysOverdue };
    });

    // Sort
    switch (sortBy) {
        case 'overdue':
            peopleWithStatus.sort((a, b) => b.daysOverdue - a.daysOverdue);
            break;
        case 'name':
            peopleWithStatus.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'recent':
            peopleWithStatus.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
    }

    peopleList.innerHTML = peopleWithStatus.map(person => {
        let statusClass, statusText;

        if (person.daysOverdue > 0) {
            statusClass = 'status-overdue';
            statusText = `${person.daysOverdue} days overdue`;
        } else if (person.daysOverdue > -7) {
            statusClass = 'status-due-soon';
            statusText = `Due in ${Math.abs(person.daysOverdue)} days`;
        } else {
            statusClass = 'status-good';
            statusText = `${Math.abs(person.daysOverdue)} days left`;
        }

        const frequencyText = person.frequency === 7 ? 'weekly' :
                             person.frequency === 14 ? 'every 2 weeks' :
                             person.frequency === 30 ? 'monthly' : 'quarterly';

        return `
            <div class="person-card">
                <div class="person-card-header">
                    <span class="person-name">${escapeHtml(person.name)}</span>
                    <span class="person-status ${statusClass}">${statusText}</span>
                </div>
                <div class="person-meta">
                    Reach out ${frequencyText} · Last contact: ${Utils.formatDate(person.last_contact)}
                </div>
                ${person.notes ? `<div class="person-notes">"${escapeHtml(person.notes)}"</div>` : ''}
                <div class="person-actions">
                    <button class="btn btn-success btn-small" onclick="openReachOutModal('${person.id}', '${escapeHtml(person.name)}')">
                        ✓ Log Reach Out
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="addCommitmentFor('${person.id}')">
                        + Add Commitment
                    </button>
                    <button class="btn-delete" onclick="deletePerson('${person.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Render commitments list
function renderCommitments() {
    const commitmentsList = document.getElementById('commitments-list');
    let commitments = [...commitmentsCache];

    // Filter
    if (currentCommitmentFilter === 'pending') {
        commitments = commitments.filter(c => !c.completed);
    } else if (currentCommitmentFilter === 'completed') {
        commitments = commitments.filter(c => c.completed);
    }

    // Update count (always show pending count)
    const pendingCount = commitmentsCache.filter(c => !c.completed).length;
    document.getElementById('commitments-count').textContent = pendingCount;

    if (commitments.length === 0) {
        const message = currentCommitmentFilter === 'pending'
            ? 'No pending commitments. Great job staying on top of things!'
            : currentCommitmentFilter === 'completed'
            ? 'No completed commitments yet.'
            : 'No commitments tracked yet. Add one above!';
        commitmentsList.innerHTML = `<p class="empty-state">${message}</p>`;
        return;
    }

    // Sort by due date (most urgent first)
    commitments.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.due_date) - new Date(b.due_date);
    });

    commitmentsList.innerHTML = commitments.map(commitment => {
        const person = peopleCache.find(p => p.id === commitment.person_id);
        const personName = person ? person.name : 'Unknown';
        const daysUntil = Utils.daysUntil(commitment.due_date);

        let dueClass = '';
        let dueText = Utils.formatDate(commitment.due_date);

        if (!commitment.completed) {
            if (daysUntil < 0) {
                dueClass = 'overdue';
                dueText = `${Math.abs(daysUntil)} days overdue`;
            } else if (daysUntil === 0) {
                dueClass = 'overdue';
                dueText = 'Due today!';
            } else if (daysUntil <= 3) {
                dueText = `Due in ${daysUntil} days`;
            }
        }

        return `
            <div class="commitment-card ${commitment.completed ? 'completed' : ''}">
                <div class="commitment-card-header">
                    <span class="commitment-text">${escapeHtml(commitment.text)}</span>
                    ${commitment.completed ? '<span class="completed-badge">Completed</span>' : ''}
                </div>
                <div class="commitment-person">To: ${escapeHtml(personName)}</div>
                <div class="commitment-due ${dueClass}">Due: ${dueText}</div>
                <div class="commitment-actions">
                    ${!commitment.completed ? `
                        <button class="btn btn-success btn-small" onclick="completeCommitment('${commitment.id}')">
                            ✓ Mark Complete
                        </button>
                    ` : `
                        <button class="btn btn-secondary btn-small" onclick="uncompleteCommitment('${commitment.id}')">
                            ↩ Mark Incomplete
                        </button>
                    `}
                    <button class="btn-delete" onclick="deleteCommitment('${commitment.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Update person dropdown in commitment form
function updatePersonDropdown() {
    const select = document.getElementById('commitment-person');

    select.innerHTML = '<option value="">Who did you commit to?</option>' +
        peopleCache.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

// Action functions
function openReachOutModal(personId, personName) {
    currentPersonForModal = personId;
    document.getElementById('modal-person-name').textContent = `Reaching out to ${personName}`;
    document.getElementById('reach-out-notes').value = '';
    document.getElementById('reach-out-modal').classList.add('active');
}

function addCommitmentFor(personId) {
    document.querySelector('[data-tab="commitments"]').click();
    document.getElementById('commitment-person').value = personId;
    document.getElementById('commitment-text').focus();
}

async function deletePerson(personId) {
    if (!confirm('Are you sure you want to remove this person? Their commitments will also be deleted.')) return;

    const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', personId);

    if (error) {
        console.error('Error deleting person:', error);
        alert('Error deleting person. Please try again.');
        return;
    }

    peopleCache = peopleCache.filter(p => p.id !== personId);
    commitmentsCache = commitmentsCache.filter(c => c.person_id !== personId);
    renderPeople();
    renderCommitments();
    updatePersonDropdown();
}

async function completeCommitment(commitmentId) {
    const { error } = await supabase
        .from('commitments')
        .update({
            completed: true,
            completed_at: new Date().toISOString()
        })
        .eq('id', commitmentId);

    if (error) {
        console.error('Error completing commitment:', error);
        alert('Error completing commitment. Please try again.');
        return;
    }

    const commitment = commitmentsCache.find(c => c.id === commitmentId);
    if (commitment) {
        commitment.completed = true;
        commitment.completed_at = new Date().toISOString();
    }
    renderCommitments();
}

async function uncompleteCommitment(commitmentId) {
    const { error } = await supabase
        .from('commitments')
        .update({
            completed: false,
            completed_at: null
        })
        .eq('id', commitmentId);

    if (error) {
        console.error('Error uncompleting commitment:', error);
        alert('Error updating commitment. Please try again.');
        return;
    }

    const commitment = commitmentsCache.find(c => c.id === commitmentId);
    if (commitment) {
        commitment.completed = false;
        commitment.completed_at = null;
    }
    renderCommitments();
}

async function deleteCommitment(commitmentId) {
    if (!confirm('Are you sure you want to delete this commitment?')) return;

    const { error } = await supabase
        .from('commitments')
        .delete()
        .eq('id', commitmentId);

    if (error) {
        console.error('Error deleting commitment:', error);
        alert('Error deleting commitment. Please try again.');
        return;
    }

    commitmentsCache = commitmentsCache.filter(c => c.id !== commitmentId);
    renderCommitments();
}

// Utility to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
