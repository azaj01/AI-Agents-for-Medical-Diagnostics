const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const chatBtn = document.getElementById('chat-btn');
const logCont = document.getElementById('log-container');

let session = "";

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        location.reload();
    }
});

function addBubble(text, type = "system") {
    const b = document.createElement('div');
    b.className = `bubble ${type}`;
    
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<i>$1</i>');
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    b.innerHTML = formattedText;
    chatContainer.appendChild(b);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function setProcessing(selector, isActive) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
        isActive ? el.classList.add('processing') : el.classList.remove('processing');
    });
}
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { 
    e.preventDefault(); 
    dropzone.classList.add('dragover'); 
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => { 
    e.preventDefault(); 
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); 
});
fileInput.addEventListener('change', e => { 
    if (e.target.files.length) handleFile(e.target.files[0]); 
});

async function handleFile(file) {
    document.getElementById('n-doc').classList.remove('pulse');
    dropzone.style.display = 'none';

    setTimeout(async () => {
        logCont.style.display = 'flex'; 

        document.querySelectorAll('.phase1').forEach(el => el.classList.add('active')); 
        document.querySelectorAll('.phase1 animateMotion').forEach(anim => anim.beginElement()); 

        setTimeout(() => {
            document.querySelectorAll('.phase1').forEach(el => el.classList.remove('active'));
            setProcessing('.agent', true); 
            
            document.querySelectorAll('.agent').forEach(el => {
                el.classList.remove('done');
                delete el.dataset.result;
            });
            
            document.getElementById('working-text').classList.add('active');
        }, 2000);

        const fd = new FormData(); 
        fd.append("file", file);
        
      try {
            const res = await fetch('/analyze', { method: 'POST', body: fd });
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            
            let buffer = "";
            let consensusData = null;
            let agentsDoneCount = 0;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                let boundary = buffer.indexOf('\n');
                
                while (boundary !== -1) {
                    const chunk = buffer.slice(0, boundary).trim();
                    buffer = buffer.slice(boundary + 1);
                    boundary = buffer.indexOf('\n');
                    
                    if (chunk) {
                        const data = JSON.parse(chunk);
                        
                        if (data.type === "agent_done") {
                            const role = data.role.toLowerCase();
                            let nodeId = "";
                            if (role.includes("cardio")) nodeId = "n-cardio";
                            else if (role.includes("psych")) nodeId = "n-psych";
                            else if (role.includes("pulmo")) nodeId = "n-pulmo";
                            else if (role.includes("neuro")) nodeId = "n-neuro";
                            
                            if (nodeId) {
                                const el = document.getElementById(nodeId);
                                el.classList.remove("processing");
                                el.classList.add("done");
                                el.dataset.result = data.result; 
                            }

                            agentsDoneCount++;
                            if (agentsDoneCount === 4) {
                                document.getElementById('working-text').classList.remove('active');
                                document.querySelectorAll('.phase2').forEach(el => el.classList.add('active')); 
                                document.querySelectorAll('.phase2 animateMotion').forEach(anim => anim.beginElement()); 

                                // let's put 2s delay 
                                setTimeout(() => { setProcessing('#n-llm', true);}, 2000)
                               
                            }
                        } 
                        else if (data.type === "consensus") {
                            consensusData = data;
                            session = data.session_id;
                        }
                    }
                }
            }

            const teamThinkingTime = Math.floor(Math.random() * (6000 - 2500 + 1)) + 2500;

            setTimeout(() => {
                setProcessing('#n-llm', false); 
                document.querySelectorAll('.phase2').forEach(el => el.classList.remove('active'));
                
                document.getElementById('n-final').style.opacity = '1';
                document.getElementById('n-final').classList.add('done');

                // time out of 1 second
                setTimeout(() => {
                logCont.classList.add('active'); 
                addBubble("CONSENSUS REPORT", "system");
                addBubble(consensusData.consensus, "team");
                }, 1000);


                

                setTimeout(() => {
                    chatContainer.scrollTop = 0;
                }, 50);

            }, teamThinkingTime);

        } catch (e) { 
            addBubble("Connection error. Please try again.", "system"); 
            console.error(e);
        }
    }, 2000);
}

const tooltip = document.getElementById('tooltip');
let tooltipTimeout;

document.querySelectorAll('.agent').forEach(node => {
    node.addEventListener('mouseenter', (e) => {
        clearTimeout(tooltipTimeout);
        
        if (node.classList.contains('done') && node.dataset.result) {
            const title = node.innerText.trim();
            let formatted = node.dataset.result
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\n/g, '<br>');
            
            tooltip.innerHTML = `<div class="tooltip-title">${title} Notes:</div><div class="tooltip-content">${formatted}</div>`;
            tooltip.classList.add('visible');
            
            const rect = node.getBoundingClientRect();
            const tooltipHeight = tooltip.offsetHeight;
            const windowHeight = window.innerHeight;
            
            let topPosition = rect.top;
            
            if (topPosition + tooltipHeight > windowHeight - 20) {
                topPosition = windowHeight - tooltipHeight - 20;
            }
            
            if (topPosition < 20) {
                topPosition = 20; 
            }
            
            tooltip.style.left = (rect.right + 20) + 'px';
            tooltip.style.top = topPosition + 'px';
        }
    });
    
    node.addEventListener('mouseleave', () => {
        tooltipTimeout = setTimeout(() => {
            tooltip.classList.remove('visible');
        }, 250);
    });

    node.addEventListener('wheel', (e) => {
        if (tooltip.classList.contains('visible')) {
            const content = tooltip.querySelector('.tooltip-content');
            if (content) {
                content.scrollTop += e.deltaY;
                e.preventDefault();
            }
        }
    }, { passive: false });
});

tooltip.addEventListener('mouseenter', () => {
    clearTimeout(tooltipTimeout);
});

tooltip.addEventListener('mouseleave', () => {
    tooltipTimeout = setTimeout(() => {
        tooltip.classList.remove('visible');
    }, 250);
});

async function sendMessage() {
    const msg = chatInput.value.trim(); 
    if (!msg) return;
    
    addBubble(msg, "user"); 
    chatInput.value = ""; 
    
    const thinkingId = Date.now();
    addBubble("Team is typing...", `system thinking-${thinkingId}`);
    
    try {
        const res = await fetch('/chat', { 
            method: 'POST', 
            body: new URLSearchParams({ session_id: session, message: msg }) 
        });
        const data = await res.json();
        
        document.querySelector(`.thinking-${thinkingId}`).remove();
        addBubble(data.reply, "team");
    } catch (e) {
        addBubble("The team is currently unavailable.", "system");
    }
}

chatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', e => { 
    if (e.key === 'Enter') sendMessage(); 
});