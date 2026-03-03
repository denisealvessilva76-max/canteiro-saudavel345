/**
 * Painel Administrativo - Canteiro Saudável
 * 
 * Este arquivo contém toda a lógica do painel admin standalone.
 * Conecta ao Firebase Realtime Database para buscar dados em tempo real.
 */

// ========== CONFIGURAÇÃO DO FIREBASE ==========
// IMPORTANTE: Substitua com suas credenciais reais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB32S5Eac0guxy1herefub70AIAGkgF1Rw",
    authDomain: "canteiro-saudavel.firebaseapp.com",
    databaseURL: "https://canteiro-saudavel-default-rtdb.firebaseio.com",
    projectId: "canteiro-saudavel",
    storageBucket: "canteiro-saudavel.firebasestorage.app",
    messagingSenderId: "37768857073",
    appId: "1:37768857073:web:3e62666713391869813050",
    measurementId: "G-1BZG7Q9NL4"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========== ESTADO DA APLICAÇÃO ==========
let currentUser = null;
let employeesData = [];
let unsubscribe = null;

// ========== ELEMENTOS DO DOM ==========
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const adminEmailDisplay = document.getElementById('admin-email-display');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const loadingOverlay = document.getElementById('loading-overlay');

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Search
const searchInput = document.getElementById('search-employee');

// ========== AUTENTICAÇÃO ==========
function login(email, password) {
    // Login simples (em produção, use Firebase Auth)
    const validCredentials = [
        { email: 'admin@canteiro.com', password: 'admin123' },
        { email: 'sesmt@empresa.com', password: 'sesmt2024' },
        { email: 'denise.silva@mip.com.br', password: 'mip2024' },
        { email: 'estefane.mendes@mip.com.br', password: 'mip2024' }
    ];
    
    const user = validCredentials.find(
        u => u.email === email && u.password === password
    );
    
    if (user) {
        currentUser = { email: user.email };
        localStorage.setItem('admin_user', JSON.stringify(currentUser));
        showDashboard();
        return true;
    }
    
    return false;
}

function logout() {
    currentUser = null;
    localStorage.removeItem('admin_user');
    if (unsubscribe) {
        unsubscribe();
    }
    showLogin();
}

function checkAuth() {
    const stored = localStorage.getItem('admin_user');
    if (stored) {
        currentUser = JSON.parse(stored);
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    loginScreen.classList.add('active');
    dashboardScreen.classList.remove('active');
}

function showDashboard() {
    loginScreen.classList.remove('active');
    dashboardScreen.classList.add('active');
    adminEmailDisplay.textContent = currentUser.email;
    loadEmployeesData();
}

// ========== FIREBASE DATA ==========
function loadEmployeesData() {
    showLoading(true);
    
    // Escutar mudanças em tempo real
    const employeesRef = database.ref('canteiro-saudavel/employees');
    
    unsubscribe = employeesRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            employeesData = Object.keys(data).map(matricula => {
                const employee = data[matricula];
                return {
                    matricula,
                    ...employee.profile,
                    hydration: employee.hydration || {},
                    pressure: employee.pressure || {},
                    symptoms: employee.symptoms || {},
                    checkins: employee.checkins || {},
                    challenges: employee.challenges || {}
                };
            });
            
            console.log(`[Admin] Loaded ${employeesData.length} employees`);
            updateDashboard();
        } else {
            console.log('[Admin] No employees data found');
            employeesData = [];
            updateDashboard();
        }
        
        showLoading(false);
    }, (error) => {
        console.error('[Admin] Error loading data:', error);
        showLoading(false);
        alert('Erro ao carregar dados do Firebase. Verifique a configuração.');
    });
}

function updateDashboard() {
    updateStats();
    updateEmployeesList();
    updateRecentActivity();
    updateCharts();
}

// ========== ESTATÍSTICAS ==========
function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Funcionários ativos (check-in nos últimos 7 dias)
    const activeEmployees = employeesData.filter(emp => {
        const lastCheckin = getLastCheckin(emp);
        return lastCheckin && lastCheckin >= weekAgo;
    }).length;
    
    // Hidratação média
    const hydrationData = employeesData.map(emp => {
        const todayHydration = emp.hydration[today];
        if (todayHydration) {
            const goal = todayHydration.goal || 2000;
            const intake = todayHydration.waterIntake || 0;
            return (intake / goal) * 100;
        }
        return 0;
    });
    const avgHydration = hydrationData.length > 0
        ? Math.round(hydrationData.reduce((a, b) => a + b, 0) / hydrationData.length)
        : 0;
    
    // Pressão monitorada (registros nos últimos 7 dias)
    const pressureMonitored = employeesData.filter(emp => {
        const readings = Object.values(emp.pressure);
        return readings.some(r => r.date >= weekAgo);
    }).length;
    
    // Queixas na semana
    const complaintsCount = employeesData.reduce((total, emp) => {
        const symptoms = Object.values(emp.symptoms);
        const recentSymptoms = symptoms.filter(s => s.date >= weekAgo);
        return total + recentSymptoms.length;
    }, 0);
    
    // Check-ins hoje
    const checkinsToday = employeesData.filter(emp => {
        const lastCheckin = getLastCheckin(emp);
        return lastCheckin === today;
    }).length;
    
    // Desafios ativos
    const activeChallenges = employeesData.reduce((total, emp) => {
        const challenges = Object.values(emp.challenges);
        const active = challenges.filter(c => c.status === 'active');
        return total + active.length;
    }, 0);
    
    // Atualizar DOM
    document.getElementById('stat-active').textContent = activeEmployees;
    document.getElementById('stat-hydration').textContent = `${avgHydration}%`;
    document.getElementById('stat-pressure').textContent = pressureMonitored;
    document.getElementById('stat-complaints').textContent = complaintsCount;
    document.getElementById('stat-checkins').textContent = checkinsToday;
    document.getElementById('stat-challenges').textContent = activeChallenges;
}

// ========== LISTA DE FUNCIONÁRIOS ==========
function updateEmployeesList() {
    const container = document.getElementById('employees-list');
    
    if (employeesData.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum funcionário cadastrado ainda.</p>';
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    container.innerHTML = employeesData.map(emp => {
        const lastCheckin = getLastCheckin(emp);
        const isActive = lastCheckin && lastCheckin >= weekAgo;
        
        const todayHydration = emp.hydration[today];
        const hydrationText = todayHydration
            ? `${todayHydration.waterIntake || 0}ml / ${todayHydration.goal || 2000}ml`
            : 'Sem dados';
        
        const lastPressure = getLastPressure(emp);
        const pressureText = lastPressure
            ? `${lastPressure.systolic}/${lastPressure.diastolic} mmHg`
            : 'Sem dados';
        
        const complaintsCount = Object.values(emp.symptoms).filter(s => s.date >= weekAgo).length;
        
        return `
            <div class="employee-card">
                <div class="employee-header">
                    <div>
                        <div class="employee-name">${emp.name || 'Sem nome'}</div>
                        <div class="employee-matricula">Mat: ${emp.matricula}</div>
                    </div>
                    <span class="employee-status ${isActive ? 'status-active' : 'status-inactive'}">
                        ${isActive ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
                <div class="employee-info">
                    <div class="info-row">
                        <span class="info-label">Cargo</span>
                        <span class="info-value">${emp.cargo || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Turno</span>
                        <span class="info-value">${emp.turno || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Hidratação Hoje</span>
                        <span class="info-value">${hydrationText}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Última Pressão</span>
                        <span class="info-value">${pressureText}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Queixas (7 dias)</span>
                        <span class="info-value">${complaintsCount}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Último Check-in</span>
                        <span class="info-value">${lastCheckin || 'Nunca'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ========== ATIVIDADE RECENTE ==========
function updateRecentActivity() {
    const container = document.getElementById('recent-activity');
    const activities = [];
    
    const today = new Date().toISOString().split('T')[0];
    
    // Coletar atividades
    employeesData.forEach(emp => {
        // Check-ins
        const lastCheckin = getLastCheckin(emp);
        if (lastCheckin === today) {
            activities.push({
                time: new Date(),
                title: `✅ Check-in realizado`,
                description: `${emp.name} (${emp.matricula}) fez check-in hoje`
            });
        }
        
        // Sintomas
        const recentSymptoms = Object.values(emp.symptoms).filter(s => s.date === today);
        recentSymptoms.forEach(symptom => {
            activities.push({
                time: new Date(symptom.timestamp || Date.now()),
                title: `⚠️ Sintoma reportado`,
                description: `${emp.name} reportou: ${symptom.symptoms?.join(', ') || 'sintomas'}`
            });
        });
    });
    
    // Ordenar por tempo (mais recente primeiro)
    activities.sort((a, b) => b.time - a.time);
    
    if (activities.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhuma atividade recente hoje.</p>';
        return;
    }
    
    container.innerHTML = activities.slice(0, 10).map(activity => `
        <div class="activity-item">
            <div class="activity-header">
                <span class="activity-title">${activity.title}</span>
                <span class="activity-time">${formatTime(activity.time)}</span>
            </div>
            <p class="activity-description">${activity.description}</p>
        </div>
    `).join('');
}

// ========== GRÁFICOS ==========
function updateCharts() {
    // Implementação básica de gráficos com Chart.js
    // Você pode expandir isso conforme necessário
    
    // Hidratação Semanal
    const hydrationCtx = document.getElementById('hydration-chart');
    if (hydrationCtx && typeof Chart !== 'undefined') {
        new Chart(hydrationCtx, {
            type: 'line',
            data: {
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
                datasets: [{
                    label: 'Hidratação Média (%)',
                    data: [75, 80, 70, 85, 90, 65, 70],
                    borderColor: '#0a7ea4',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// ========== HELPERS ==========
function getLastCheckin(employee) {
    const checkins = Object.values(employee.checkins);
    if (checkins.length === 0) return null;
    
    const sorted = checkins.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    return sorted[0]?.date || null;
}

function getLastPressure(employee) {
    const readings = Object.values(employee.pressure);
    if (readings.length === 0) return null;
    
    const sorted = readings.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    return sorted[0] || null;
}

function formatTime(date) {
    return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// ========== EVENT LISTENERS ==========
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    if (login(email, password)) {
        loginError.style.display = 'none';
    } else {
        loginError.textContent = 'Email ou senha inválidos';
        loginError.style.display = 'block';
    }
});

logoutBtn.addEventListener('click', logout);

refreshBtn.addEventListener('click', () => {
    showLoading(true);
    loadEmployeesData();
});

// Tabs
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Search
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.employee-card');
        
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(query) ? 'block' : 'none';
        });
    });
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});


// ========== EXPORTAÇÃO DE PDF ==========
async function exportToPDF() {
    try {
        showLoading(true);
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let yPosition = margin;
        
        // ===== CABEÇALHO =====
        pdf.setFillColor(10, 126, 164); // --primary
        pdf.rect(0, 0, pageWidth, 40, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('🏗️ Canteiro Saudável', margin, 20);
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Relatório Mensal de Saúde e Bem-Estar', margin, 30);
        
        yPosition = 50;
        
        // ===== INFORMAÇÕES DO RELATÓRIO =====
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        const now = new Date();
        const monthYear = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        pdf.text(`Período: ${monthYear}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Gerado em: ${now.toLocaleString('pt-BR')}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Administrador: ${currentUser.email}`, margin, yPosition);
        yPosition += 15;
        
        // ===== ESTATÍSTICAS GERAIS =====
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(10, 126, 164);
        pdf.text('📊 Estatísticas Gerais', margin, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        const stats = [
            { label: 'Funcionários Ativos', value: document.getElementById('stat-active').textContent, icon: '👷' },
            { label: 'Hidratação Média', value: document.getElementById('stat-hydration').textContent, icon: '💧' },
            { label: 'Pressão Monitorada', value: document.getElementById('stat-pressure').textContent, icon: '🩺' },
            { label: 'Queixas na Semana', value: document.getElementById('stat-complaints').textContent, icon: '⚠️' },
            { label: 'Check-ins Hoje', value: document.getElementById('stat-checkins').textContent, icon: '✅' },
            { label: 'Desafios Ativos', value: document.getElementById('stat-challenges').textContent, icon: '🎯' }
        ];
        
        const statsPerRow = 2;
        const statWidth = (pageWidth - 2 * margin - 10) / statsPerRow;
        const statHeight = 20;
        
        stats.forEach((stat, index) => {
            const col = index % statsPerRow;
            const row = Math.floor(index / statsPerRow);
            const x = margin + col * (statWidth + 10);
            const y = yPosition + row * (statHeight + 5);
            
            // Box
            pdf.setFillColor(245, 245, 245);
            pdf.roundedRect(x, y, statWidth, statHeight, 3, 3, 'F');
            
            // Icon e Label
            pdf.setFontSize(9);
            pdf.setTextColor(104, 112, 118); // --muted
            pdf.text(`${stat.icon} ${stat.label}`, x + 5, y + 8);
            
            // Value
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text(stat.value, x + 5, y + 16);
            pdf.setFont('helvetica', 'normal');
        });
        
        yPosition += Math.ceil(stats.length / statsPerRow) * (statHeight + 5) + 15;
        
        // ===== GRÁFICOS =====
        if (yPosition > pageHeight - 100) {
            pdf.addPage();
            yPosition = margin;
        }
        
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(10, 126, 164);
        pdf.text('📈 Gráficos e Tendências', margin, yPosition);
        yPosition += 10;
        
        // Capturar gráficos (se existirem)
        const chartElements = document.querySelectorAll('canvas');
        if (chartElements.length > 0) {
            for (let i = 0; i < Math.min(chartElements.length, 4); i++) {
                const canvas = chartElements[i];
                if (canvas.width > 0 && canvas.height > 0) {
                    try {
                        const imgData = canvas.toDataURL('image/png');
                        const imgWidth = pageWidth - 2 * margin;
                        const imgHeight = (canvas.height / canvas.width) * imgWidth;
                        
                        if (yPosition + imgHeight > pageHeight - margin) {
                            pdf.addPage();
                            yPosition = margin;
                        }
                        
                        pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
                        yPosition += imgHeight + 10;
                    } catch (error) {
                        console.error('Erro ao capturar gráfico:', error);
                    }
                }
            }
        } else {
            pdf.setFontSize(10);
            pdf.setTextColor(104, 112, 118);
            pdf.text('Nenhum gráfico disponível no momento.', margin, yPosition);
            yPosition += 10;
        }
        
        // ===== LISTA DE FUNCIONÁRIOS =====
        if (yPosition > pageHeight - 60) {
            pdf.addPage();
            yPosition = margin;
        }
        
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(10, 126, 164);
        pdf.text('👷 Lista de Funcionários', margin, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        const today = new Date().toISOString().split('T')[0];
        const employeesToShow = employeesData.slice(0, 20); // Limitar a 20 para não sobrecarregar
        
        employeesToShow.forEach((emp, index) => {
            if (yPosition > pageHeight - 20) {
                pdf.addPage();
                yPosition = margin;
            }
            
            const todayHydration = emp.hydration[today];
            const hydrationText = todayHydration
                ? `${todayHydration.waterIntake || 0}ml`
                : 'Sem dados';
            
            const lastPressure = getLastPressure(emp);
            const pressureText = lastPressure
                ? `${lastPressure.systolic}/${lastPressure.diastolic}`
                : 'N/A';
            
            // Linha do funcionário
            pdf.setFillColor(index % 2 === 0 ? 255 : 245);
            pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 8, 'F');
            
            pdf.text(`${index + 1}. ${emp.name || 'Sem nome'}`, margin + 2, yPosition);
            pdf.text(`Mat: ${emp.matricula}`, margin + 70, yPosition);
            pdf.text(`Hidrat: ${hydrationText}`, margin + 110, yPosition);
            pdf.text(`PA: ${pressureText}`, margin + 150, yPosition);
            
            yPosition += 8;
        });
        
        if (employeesData.length > 20) {
            yPosition += 5;
            pdf.setFontSize(8);
            pdf.setTextColor(104, 112, 118);
            pdf.text(`... e mais ${employeesData.length - 20} funcionários`, margin, yPosition);
        }
        
        // ===== RODAPÉ =====
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(
                `Canteiro Saudável - Relatório Confidencial | Página ${i} de ${totalPages}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
        }
        
        // ===== SALVAR PDF =====
        const fileName = `Canteiro_Saudavel_Relatorio_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.pdf`;
        pdf.save(fileName);
        
        showLoading(false);
        alert(`✅ Relatório PDF gerado com sucesso!\n\nArquivo: ${fileName}`);
        
    } catch (error) {
        console.error('[PDF] Erro ao gerar PDF:', error);
        showLoading(false);
        alert('❌ Erro ao gerar PDF. Verifique o console para mais detalhes.');
    }
}

// ===== EVENT LISTENER PARA BOTÃO DE EXPORTAR PDF =====
const exportPdfBtn = document.getElementById('export-pdf-btn');
if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportToPDF);
}
