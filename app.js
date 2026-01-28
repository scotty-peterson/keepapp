// Keep Up App - Stay connected with the people who matter

// Data management
const Storage = {
    getPeople: () => JSON.parse(localStorage.getItem('keepup_people')) || [],
    savePeople: (people) => localStorage.setItem('keepup_people', JSON.stringify(people)),
    getCommitments: () => JSON.parse(localStorage.getItem('keepup_commitments')) || [],
    saveCommitments: (commitments) => localStorage.setItem('keepup_commitments', JSON.stringify(commitments))
};

// Utility functions
const Utils = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),

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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initForms();
    initModal();
    initFilters();
    renderPeople();
    renderCommitments();
    updatePersonDropdown();
});

// Tab switching
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Form handling
function initForms() {
    // Add person form
    document.getElementById('add-person-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('person-name').value.trim();
        const frequency = parseInt(document.getElementById('person-frequency').value);
        const notes = document.getElementById('person-notes').value.trim();

        if (!name || !frequency) return;

        const person = {
            id: Utils.generateId(),
            name,
            frequency,
            notes,
            lastContact: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };

        const people = Storage.getPeople();
        people.push(person);
        Storage.savePeople(people);

        e.target.reset();
        renderPeople();
        updatePersonDropdown();
    });

    // Add commitment form
    document.getElementById('add-commitment-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const personId = document.getElementById('commitment-person').value;
        const dueDate = document.getElementById('commitment-due').value;
        const text = document.getElementById('commitment-text').value.trim();

        if (!personId || !dueDate || !text) return;

        const commitment = {
            id: Utils.generateId(),
            personId,
            dueDate,
            text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        const commitments = Storage.getCommitments();
        commitments.push(commitment);
        Storage.saveCommitments(commitments);

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

    document.getElementById('confirm-reach-out').addEventListener('click', () => {
        if (!currentPersonForModal) return;

        const people = Storage.getPeople();
        const person = people.find(p => p.id === currentPersonForModal);
        if (person) {
            person.lastContact = new Date().toISOString().split('T')[0];
            Storage.savePeople(people);
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
    const people = Storage.getPeople();
    const sortBy = document.getElementById('sort-people').value;

    document.getElementById('people-count').textContent = people.length;

    if (people.length === 0) {
        peopleList.innerHTML = '<p class="empty-state">No people added yet. Add someone above to get started!</p>';
        return;
    }

    // Calculate days overdue for each person
    const peopleWithStatus = people.map(person => {
        const daysSinceContact = Utils.daysSince(person.lastContact);
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
            peopleWithStatus.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
                    Reach out ${frequencyText} · Last contact: ${Utils.formatDate(person.lastContact)}
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
    let commitments = Storage.getCommitments();
    const people = Storage.getPeople();

    // Filter
    if (currentCommitmentFilter === 'pending') {
        commitments = commitments.filter(c => !c.completed);
    } else if (currentCommitmentFilter === 'completed') {
        commitments = commitments.filter(c => c.completed);
    }

    // Update count (always show pending count)
    const pendingCount = Storage.getCommitments().filter(c => !c.completed).length;
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
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    commitmentsList.innerHTML = commitments.map(commitment => {
        const person = people.find(p => p.id === commitment.personId);
        const personName = person ? person.name : 'Unknown';
        const daysUntil = Utils.daysUntil(commitment.dueDate);

        let dueClass = '';
        let dueText = Utils.formatDate(commitment.dueDate);

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
    const people = Storage.getPeople();

    select.innerHTML = '<option value="">Who did you commit to?</option>' +
        people.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

// Action functions
function openReachOutModal(personId, personName) {
    currentPersonForModal = personId;
    document.getElementById('modal-person-name').textContent = `Reaching out to ${personName}`;
    document.getElementById('reach-out-notes').value = '';
    document.getElementById('reach-out-modal').classList.add('active');
}

function addCommitmentFor(personId) {
    // Switch to commitments tab
    document.querySelector('[data-tab="commitments"]').click();
    // Pre-select the person
    document.getElementById('commitment-person').value = personId;
    // Focus on the text input
    document.getElementById('commitment-text').focus();
}

function deletePerson(personId) {
    if (!confirm('Are you sure you want to remove this person? Their commitments will remain.')) return;

    const people = Storage.getPeople().filter(p => p.id !== personId);
    Storage.savePeople(people);
    renderPeople();
    updatePersonDropdown();
}

function completeCommitment(commitmentId) {
    const commitments = Storage.getCommitments();
    const commitment = commitments.find(c => c.id === commitmentId);
    if (commitment) {
        commitment.completed = true;
        commitment.completedAt = new Date().toISOString();
        Storage.saveCommitments(commitments);
        renderCommitments();
    }
}

function uncompleteCommitment(commitmentId) {
    const commitments = Storage.getCommitments();
    const commitment = commitments.find(c => c.id === commitmentId);
    if (commitment) {
        commitment.completed = false;
        delete commitment.completedAt;
        Storage.saveCommitments(commitments);
        renderCommitments();
    }
}

function deleteCommitment(commitmentId) {
    if (!confirm('Are you sure you want to delete this commitment?')) return;

    const commitments = Storage.getCommitments().filter(c => c.id !== commitmentId);
    Storage.saveCommitments(commitments);
    renderCommitments();
}

// Utility to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
