const form=document.getElementById("googleForm");
const successScreen=document.getElementById("successScreen");
const submitAnother=document.getElementById("submitAnother");
const questions=document.querySelectorAll("[data-question]");

const fullNameInput=document.getElementById("fullName");
const emailInput=document.getElementById("email");
const departmentInput=document.getElementById("department");
const fullNameError=document.getElementById("fullNameError");
const emailError=document.getElementById("emailError");
const levelError=document.getElementById("levelError");
const departmentError=document.getElementById("departmentError");

const addQuestionBtn=document.getElementById("addQuestionBtn");
const builderQuestions=document.getElementById("builderQuestions");

let draggedQuestionId=null;
const STORAGE_KEY="form_builder_current_form";

const appState={
  mode:"builder",
  form:{
    title:"Untitled form",
    description:"",
    theme:"classic",
    style:{
      layout:"comfortable",
      card:"soft",
      corners:"rounded",
      animation:"subtle",
      numbering:"none",
      background:"solid"
    }
  },
  sections:[
  {
  id:crypto.randomUUID(),
  title:"Section 1",
  description:"",
  questions:[]
}],

responses:{},
respondent: {
    currentSection:0,
    currentQuestion: 0,
    completed: false
}
};

const history={
  past:[],
  future:[]
};

function createSnapshot(){
  return structuredClone(appState);
}

function pushHistory(){
  history.past.push(createSnapshot());
  if(history.past.length>50){
    history.past.shift();
  }
  history.future=[];
}

function undo(){
  if(history.past.length===0){
    return;
  }
  history.future.push(createSnapshot());
  const previous=history.past.pop();
  Object.assign(appState,previous);
  scheduleSave();
  renderApp();
}

function redo(){
  if(history.future.length===0){
    return;
  }
  history.future.push(createSnapshot());
  const next=history.future.pop();
  Object.assign(appState,next);
  scheduleSave();
  renderApp();
}

function renderApp(){
  initializeQuestionState();
  updateModeUI();
  if(appState.mode==="builder"){
  renderBuilderMode();
  }
  else if(appState.mode==="preview"){
  renderPreviewMode();
  }
}

updateFlowHealthBadge();

function showSaveStatus(message){
  const status=document.getElementById("saveStatus");
  if(!status){
    console.warn("Save status element #saveStatus was not found,");
    return;
  }
  const text=status.querySelector("span");
  if(!text){
    console.warn("Save status text element was not found.");
    return;
  }
  text.textContent=message;
}


function saveForm(){
  try{
    const formDocument=createFormDocument();
    localStorage.setItem(
      STORAGE_KEY,JSON.stringify(formDocument)
    );
    console.log("Form saved successfully.");
    showSaveStatus("Saved");
  }catch(error){
    console.error("Failed to save form:",error);
    showSaveStatus("Save failed");
  }
}

function loadForm(){
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    if(!saved){
      console.log("No saved form found.");
      return false;
    }
    const formDocument=JSON.parse(saved);
    if(!formDocument || !formDocument.form || !Array.isArray(
      formDocument.sections)){
      console.warn("Invalid saved form.");
      return false;
    }
    const normalized=normalizeFormDocument(formDocument);
    appState.form=normalized.form;
    appState.sections=normalized.sections;
    console.log("Form restored successfully.");
    return true;
  }
  catch(error){
    console.error("Failed to load form:",error);
    return false;
  }
}

document.getElementById("undoBtn").addEventListener("click",undo);
document.getElementById("redoBtn").addEventListener("click",redo);

function updateHistoryButtons(){
  const undoBtn=document.getElementById("undoBtn");
  const redoBtn=document.getElementById("redoBtn");
  if(!undoBtn || !redoBtn){
    return;
  }
  undoBtn.disabled=history.past.length===0;
  redoBtn.disabled=history.future.length===0;
}

const QUESTION_TYPES=[
    {
        type: "short-answer",
        label: "Short answer",
        description:"A single line of text",
        icon:"fa-solid fa-i-cursor",
        category:"basic"
    },
    {
        type: "paragraph",
        label: "Paragraph",
        description:"Long-form written response",
        icon:"fa-solid fa-align-left",
        category:"basic"
    },
    {
        type: "multiple-choice",
        label: "Multiple choice",
        description: "Choose one option",
        icon:"fa-regular fa-circle-dot",
        category:"choice",
        hasOptions:true
    },
    {
        type: "checkboxes",
        label: "Checkboxes",
        description: "Choose one or more options",
        icon:"fa-regular fa-square-check",
        category:"choice",
        hasOptions:true
    },
    {
        type: "dropdown",
        label: "Dropdown",
        description:"Select from a dropdown",
        icon: "fa-solid fa-chevron-down",
        category: "choice",
        hasOptions:true
    },
    {
        type: "rating",
        label: "Rating",
        description:"Rate something with stars or icons",
        icon:"fa-solid fa-star",
        category:"advanced"
    },
    {
        type: "linear-scale",
        label: "Linear scale",
        description:"Choose a value on a scale",
        icon:"fa-solid fa-sliders",
        category:"advanced"
    },
    {
        type: "date",
        label: "Date",
        description:"Choose a calendar date",
        icon:"fa-regular fa-calendar",
        category:"basic"
    },
    {
        type: "time",
        label: "Time",
        description:"Choose a time",
        icon:"fa-regular fa-clock",
        category:"basic"
    }
];

const QUESTION_TEMPLATES = [
    {
        id: "student-info",
        label:"Student information",
        description:"Name, programme and level",
        icon:"fa-solid fa-graduation-cap",
        questions:[
            {
                type:"short-answer",
                title:"What is your full name?",
                required:true
            },
            {
                type:"short-answer",
                title:"What is your programme?",
                required:true
            },
            {
                type:"dropdown",
                title:"What is your level?",
                options: ["Level 100","Level 200","Level 300","Level 400"
                ],required:true
            }]
    },
    {
        id:"satisfaction",
        label:"Satisfaction survey",
        description:"Measure user satisfaction",
        icon:"fa-solid fa-face-smile",
        questions:[{
                type:"rating",
                title:"How satisfied are you?",
                scale:5, required:true
            },
            {
                type:"paragraph",
                title:"What could we improve?",
                required:false
            }]
    },
    {
        id:"contact",
        label:"Contact information",
        description:"Collect basic contact details",
        icon:"fa-solid fa-address-card",
        questions:[
            {
                type:"short-answer",
                title:"Full name",
                required:true
            },
            {
                type:"short-answer",
                title:"Email address",
                required:true
            },
            {
                type:"short-answer",
                title:"Phone number",
                required:false
            }]
    }
];

function checkUnreachableSections(sections,issues){
    const reachable=new Set();
    if(sections.length){
        reachable.add(sections[0].id);}
    let changed=true;
    while(changed){
        changed=false;
        sections.forEach(
            section=>{
                if(!reachable.has(section.id)){
                    return;
                }
                section.questions?.forEach(
                        question=>{question.logic?.forEach(
                                    rule=>{
                                        if(rule.action !=="go-to-section"){
                                            return;
                                        }
                                        if(!reachable.has(rule.target)){
                                            reachable.add(rule.target);
                                            changed=true;
                                        }
                                    });
                        });
            });
    }
    sections.forEach(section=>{
       if(!reachable.has(section.id)){
                issues.push({
                    id:crypto.randomUUID(),
                    severity:"warning",
                    type:"unreachable-section",
                    sectionId:section.id,
                    title:`${section.title || "Untitled section"} is unreachable`,
                    description:"Respondents currently have no path that leads to this section."});
            }});
}

function checkDeadEnds(sections,issues){
    sections.forEach(section=>{
            const questions=section.questions || [];
            if (!questions.length){
                return;
            }
            const lastQuestion=questions[questions.length-1
                ];
            const hasLogic=lastQuestion.logic?.length;
            if(!hasLogic && section !== sections[sections.length - 1]){
                issues.push({
                    id:crypto.randomUUID(),
                    severity:"warning",
                    type:"possible-dead-end",
                    sectionId:section.id,
                    questionId:lastQuestion.id,
                    title:"Possible dead end",
                    description:`The last question in "${section.title || "this section"}" has no conditional path.`
                });
            }
        });
}

function checkConditionalConflicts(sections,issues){
    sections.forEach(section=>{
            section.questions?.forEach(
                    question=>{
                        const rules=question.logic || [];
                        const seen=new Map();
                        rules.forEach(rule=>{
                                if(rule.condition !=="equals"){
                                    return;
                                }
                                const key=rule.value;
                                if(seen.has(key)){
                                    issues.push({
                                        id:crypto.randomUUID(),
                                        severity:"error",
                                        type:"conflicting-rules",
                                        questionId:question.id,
                                        sectionId:section.id,
                                        title:"Conflicting conditional rules",
                                        description:`The answer "${rule.value}" is connected to more than one destination.`
                                    });
                                }
                                seen.set(key,rule);
                            });
                    });
        });
}

function checkLoops(sections,issues){
    const graph=buildSectionGraph(sections);
    const cycles=detectCycles(graph);
    cycles.forEach(sectionId=>{
            const section=sections.find(item =>item.id===sectionId);
            issues.push({
                id:crypto.randomUUID(),
                severity:"error",
                type:"cycle",sectionId,
                title:"Circular flow detected",
                description:`The flow can return to "${section?.title || "this section"}", potentially creating an infinite respondent loop.`
            });
        });
}

function analyzeFlow(){
    const issues=[];
    const sections=appState.sections || [];
    if(!sections.length){
        issues.push({
            id: crypto.randomUUID(),
            severity: "error",
            type: "empty-form",
            title: "Your form has no sections",
            description:
                "Add at least one section before publishing."
        });
        return issues;
    }
    checkUnreachableSections(sections,issues);
    checkDeadEnds(sections,issues);
    checkConditionalConflicts(sections,issues);
    checkLoops(sections,issues);
    return issues;
}

function updateFlowHealthBadge(){
    const issues=analyzeFlow();
    const badge=document.getElementById("flowIssueBadge");
    if(!badge){return;}
    badge.textContent=issues.length;
    badge.hidden=issues.length === 0;
}

let activeSectionId=null;

function openQuestionPicker(sectionId){
    activeSectionId=sectionId;
    const overlay=document.getElementById("questionPickerOverlay");
    if(!overlay){
        return;
    }
    overlay.hidden=false;
    renderQuestionPicker();
    const search=document.getElementById("questionPickerSearch");
    requestAnimationFrame(
        function(){search?.focus();
        });
}

function closeQuestionPicker(){
    const overlay=document.getElementById("questionPickerOverlay");
    if(!overlay) {
        return;
    }
    overlay.hidden=true;
    activeSectionId=null;
}

document.getElementById("closeQuestionPicker").addEventListener("click", closeQuestionPicker
    );
    document.addEventListener("keydown",
    function(event){
        if(event.key === "Escape"){
            const overlay=document.getElementById("questionPickerOverlay");
            if(overlay && !overlay.hidden){
                closeQuestionPicker();
            }
        }
    });

function getAllQuestions(){
    return (appState.sections || []).flatMap(
        section=>section.questions || []
    );
}

function renderQuestionPicker(
    searchTerm=""){
    const container=document.getElementById("questionPickerResults");
    if(!container){
        return;
    }
    const term=searchTerm.trim().toLowerCase();
    const matchingTypes=QUESTION_TYPES.filter(
            function (item){
                return(
                    !term || item.label.toLowerCase().includes(term)||item.description.toLowerCase().includes(term)
                );
            }
        );
    const matchingTemplates=QUESTION_TEMPLATES.filter(
            function (item){
                return(
                    !term || item.label.toLowerCase().includes(term) || item.description.toLowerCase().includes(term)
                );
            }
        );
    container.innerHTML="";
    if(matchingTypes.length){
        renderPickerCategory(container,"Questions",matchingTypes,false);
    }
    if(matchingTemplates.length){
        renderPickerCategory(container,"Templates", matchingTemplates,true);
    }
    if(!matchingTypes.length && !matchingTemplates.length){
        container.innerHTML=`<div class="picker-empty">
                <i class="fa-solid fa-magnifying-glass"></i>
                <strong>Nothing found</strong>
                <span>Try another search.</span>
            </div>`;
    }
}

function renderPickerCategory(container,title,items,templates){
    const heading=document.createElement("div");
    heading.className="picker-category";
    heading.textContent=title;
    container.appendChild(heading);
    items.forEach(
        function (item){
            const button=document.createElement("button");
            button.type="button";
            button.className="picker-item";
            button.dataset.type=templates? "template": "question";
            button.dataset.id=templates?item.id:item.type;
            button.innerHTML=`<spanclass="picker-item-icon">
                    <i class="${item.icon}"></i>
                </spanclass=>
                <span class="picker-item-content">
                    <span class="picker-item-title">
                        ${escapeHTML(item.label)}
                    </span>
                    <span class="picker-item-description">
                        ${escapeHTML(item.description)}
                    </span>
                </span>`;
            container.appendChild(button);
        });
}

document.getElementById("questionPickerSearch").addEventListener("input",
        function (event){renderQuestionPicker(event.target.value);
        });
document.getElementById("questionPickerResults").addEventListener("click",
        function (event){
            const item=event.target.closest(".picker-item"              
            );
            if(!item){
                return;
            }
            if(item.dataset.type==="question"){
                addQuestionType(activeSectionId,item.dataset.id);
            }
            if(item.dataset.type==="template"){
                addQuestionTemplate(activeSectionId,item.dataset.id);
            }
            closeQuestionPicker();
        });

    function createQuestion(type){
    const question={
        id:crypto.randomUUID(),type,
        title:"Untitled question",
        description:"",
        required:false
    };
    if(type==="multiple-choice"){
        question.options=["Option 1","Option 2","Option 3"];
    }
    if(type==="checkboxes"){
        question.options=["Option 1","Option 2","Option 3"];
    }
    if(type==="dropdown"){
        question.options=["Option 1","Option 2","Option 3"];
    }
    if(type==="rating"){
        question.scale=5;
        question.icon="star";
    }
    if(type==="linear-scale"){
        question.min=1;
        question.max=5;
    }
    return question;
}

updateFlowHealthBadge();

function addQuestionType(sectionId,type){
    const section=appState.sections.find(
            function (item){
                return (item.id ===sectionId);
            });
    if(!section){
        return;
    }
    pushHistory();
    const question=createQuestion(type);
    section.questions.push(question);
    scheduleSave();
    renderApp();
    updateHistoryButtons();
}

function addQuestionTemplate(sectionId,templateId){
    const section=appState.sections.find(
            function (item){
                return (item.id ===sectionId);
            });
    const template=QUESTION_TEMPLATES.find(
            function (item){
                return (item.id ===templateId);
            });
    if(!section || !template){
        return;
    }
    pushHistory();
    const questions=template.questions.map(
            function (question){
                return {...structuredClone(question),
                    id:crypto.randomUUID()
                };
            });
    section.questions.push(...questions);
    scheduleSave();
    renderApp();
    updateHistoryButtons();
}

function renderSections(){
    const container=document.getElementById("builderSections");
    if(!container) {
        return;
    }
    container.innerHTML="";
    appState.sections.forEach(
        function (section,index){
            const element=createSectionElement(section,index);
            container.appendChild(element);
            renderSectionQuestions(element,section);
        });
}

function handleSectionAction(action,sectionId){
    switch (action){
        case "edit": editSection(sectionId);
            break;
        case "delete": deleteSection(sectionId);
            break;
        case "add-question": openQuestionPicker(sectionId);
            break;
        case "duplicate": duplicateQuestion(questionId,sectionId);
            break;
    }
}

function createSection(title="New section"){
    return {
        id:crypto.randomUUID(),title,
        description: "",
        questions: []
    };
}

function addSection(){
    pushHistory();
    const section=createSection(
            `Section ${appState.sections.length + 1}`);
    appState.sections.push(section);
    scheduleSave();
    renderApp();
    updateHistoryButtons();
}

document.getElementById("addSectionBtn").addEventListener(
  "click",addSection
);

function createSectionElement(section,index){
    const wrapper=document.createElement("section");
    wrapper.className="builder-section";
        wrapper.draggable=true;
    wrapper.dataset.sectionId=section.id;
    wrapper.innerHTML=`<div class="section-header">
            <div class="section-heading">
                <span class="section-number">${index + 1}</span>
                <div>
                    <h2 class="section-title">
                        ${escapeHTML(section.title)}
                    </h2>
                    ${section.description? `
                                <p> ${escapeHTML(section.description)}
                                </p>`: ""
                    }
                </div></div>
            <div class="section-actions">
                <button type="button"
                    class="section-action"
                    data-action="edit"
                    title="Edit section">
                    <i class="fa-solid fa-pen"></i></button>
                <button type="button"
                    class="section-action danger"
                    data-action="delete"
                    title="Delete section">
                    <i class="fa-solid fa-trash"></i></button>
            </div></div>
        <div class="section-questions"></div>
        <button type="button"
            class="add-question-to-section"
            data-action="add-question">
            <i class="fa-solid fa-plus"></i>
            Add question
        </button>`;
wrapper.addEventListener("dragstart",handleSectionDragStart);
wrapper.addEventListener("dragend",handleSectionDragEnd);
wrapper.addEventListener("dragover",handleSectionDragOver);
wrapper.addEventListener("drop",handleSectionDrop);
    return wrapper;
}
updateFlowHealthBadge();
const dragState={
  type:null,
  id:null,
  sectionId:null
};

function handleSectionDragStart(event){
    const handle=event.target.closest(".section-drag-handle");
    if(!handle){
        event.preventDefault();
        return;
    }
    const section=event.currentTarget;
    dragState.type="section";
    dragState.id=section.dataset.sectionId;
    section.classList.add("is-dragging");
    event.dataTransfer.effectAllowed="move";
}

function handleSectionDragEnd(event){
    event.currentTarget.classList.remove("is-dragging");
    document.querySelectorAll(".builder-section").forEach(
            function (section){
                section.classList.remove("drag-over");
            });
    dragState.type=null;
    dragState.id=null;
}

function handleSectionDragOver(event){
    if(dragState.type !=="section"){
        return;
    }
    event.preventDefault();
    const target=event.currentTarget;
    if(target.dataset.sectionId === dragState.id){
        return;
    }
    target.classList.add("drag-over");
    event.dataTransfer.dropEffect="move";
}

function handleSectionDrop(event){
    event.preventDefault();
    const target=event.currentTarget;
    target.classList.remove("drag-over");
    if(dragState.type !=="section"){
        return;
    }
    const sourceId=dragState.id;
    const targetId=target.dataset.sectionId;
    if(sourceId === targetId){
        return;
    }
    moveSection(sourceId,targetId);
}

function moveSection(sourceId,targetId){
    const sourceIndex=appState.sections.findIndex(
            function (section){
                return (section.id===sourceId);
            });
    const targetIndex=appState.sections.findIndex(
            function (section){
                return (section.id===targetId);
            });
    if(sourceIndex === -1 || targetIndex === -1){
        return;
    }
    pushHistory();
    const [movedSection]=appState.sections.splice(sourceIndex,1);
    appState.sections.splice(targetIndex,0,movedSection);
    scheduleSave();
    renderApp();
    updateHistoryButtons();
}

function handleQuestionDragStart(event){
    const handle=event.target.closest(".question-drag-handle");
    if(!handle){event.preventDefault();
        return;
    }
    const question=event.currentTarget;
    dragState.type="question";
    dragState.id=question.dataset.questionId;
    dragState.sectionId=question.dataset.sectionId;
    question.classList.add("is-dragging");
    event.dataTransfer.effectAllowed="move";
}

function escapeHTML(value){
    const div=document.createElement("div");
    div.textContent=value ?? "";
    return div.innerHTML;
}

function handleQuestionDragEnd(event){
    event.currentTarget.classList.remove("is-dragging");
    document.querySelectorAll(".builder-question").forEach(
            function (question){question.classList.remove("drag-over");
            });
    dragState.type=null;
    dragState.id=null;
    dragState.sectionId=null;
}

function handleQuestionDragOver(event){
    if(dragState.type!=="question"){
        return;
    }
    event.preventDefault();
    const target=event.currentTarget;
    if(target.dataset.questionId===dragState.id){
        return;
    }
    target.classList.add("drag-over");
    event.dataTransfer.dropEffect="move";
}

function handleQuestionDrop(event){
    event.preventDefault();
    const target=event.currentTarget;
    target.classList.remove("drag-over");
    if(dragState.type!=="question"){
        return;
    }
    const sourceId=dragState.id;
    const sourceSectionId=dragState.sectionId;
    const targetQuestionId=target.dataset.questionId;
    const targetSectionId=target.dataset.sectionId;
    if(sourceId===targetQuestionId){
        return;
    }
    moveQuestion(sourceId,sourceSectionId,targetQuestionId,targetSectionId);
}

function moveQuestion(sourceId,sourceSectionId,targetId,targetSectionId){
    const sourceSection=appState.sections.find(
            function (section){
                return (section.id===sourceSectionId);
            });
    const targetSection=appState.sections.find(
            function (section){
                return (section.id===targetSectionId);
            });
    if(!sourceSection || !targetSection){
        return;
    }
    const sourceIndex=sourceSection.questions.findIndex(
            function (question){
                return (question.id===sourceId);
            });
    if(sourceIndex === -1){
        return;
    }
    pushHistory();
    const [movedQuestion]=
        sourceSection.questions.splice(sourceIndex,1);
    const targetIndex=targetSection.questions.findIndex(
            function (question){
                return (
                    question.id===targetId);
            });
    if(targetIndex === -1){
        targetSection.questions.push(movedQuestion);
    } 
    else{
        targetSection.questions.splice(
            targetIndex,0,movedQuestion
        );
    }
    scheduleSave();
    renderApp();
    updateHistoryButtons();
}

function createBuilderQuestion(question,index,section){
  const card=document.createElement("div");
  card.classList.add("builder-question");
  card.draggable=true;
  card.dataset.questionId=question.id;
  card.dataset.sectionId=section.id;
  const header=document.createElement("div");
  card.classList.add("builder-question-header");
  const questionNumber=document.createElement("span");
  questionNumber.classList.add("question-number");
  questionNumber.textContent=`Question ${index+1}`;
  header.appendChild(questionNumber);
  const dragHandle=document.createElement("span");
  dragHandle.classList.add("drag-handle");
  dragHandle.innerHTML='<i class="fa-solid fa-grip-vertical"></i>';
  header.prepend(dragHandle);
  const titleInput=document.createElement("input");
  titleInput.type="text";
  titleInput.classList.add(
    "builder-question-title"
  );
  titleInput.value=question.title;
  titleInput.placeholder="Question";
  card.appendChild(header);
  card.appendChild(titleInput);
  const typeSelect=document.createElement("select");
  typeSelect.classList.add(
    "builder-question-type"
  );
  Object.entries(QUESTION_TYPES).forEach(
    function ([value,config]){
    const option=document.createElement("option");
    option.value=value;
    option.textContent=config.label;
    if(value===question.type){
      option.selected=true;
    }
    typeSelect.appendChild(option);
  });
  card.appendChild(typeSelect);
  const optionsContainer=document.createElement("div");
  optionsContainer.classList.add("builder-options");
  card.appendChild(optionsContainer);
  const requiredContainer=document.createElement("label");
  requiredContainer.classList.add("builder-required");
  const requiredCheckbox=document.createElement("input");
  requiredCheckbox.type="checkbox";
  requiredCheckbox.checked=question.required;
  requiredContainer.appendChild(requiredCheckbox);
  requiredContainer.appendChild(
    document.createTextNode("required")
  );
  card.appendChild(requiredContainer);
  const actions=document.createElement("div");
  actions.classList.add("builder-actions");
  const duplicateButton=document.createElement("button");
  duplicateButton.type="button";
  duplicateButton.textContent="Duplicate";
  const deleteButton=document.createElement("button");
  deleteButton.type="button";
  deleteButton.textContent="Delete";
  actions.appendChild(duplicateButton);
  actions.appendChild(deleteButton);
  card.appendChild(actions);
  renderBuilderOptions(
    question,optionsContainer
  );
  titleInput.addEventListener("input",function(){
    updateState(function (state){
        const location=findQuestionLocation(state,question.id);
        if(!location){return;}
        location.question.title=titleInput.value;
    });
});
  typeSelect.addEventListener("change",function(){
    updateState(function (state){
        const location=findQuestionLocation(state,question.id);
        if(!location){return;}
      const target=location.question;
      if(!target){return;}
    const newType=typeSelect.value;
    target.type=newType;
    const defaults=getDefaultQuestionConfig(newType);
    Object.assign(target,defaults);
    const configuration=document.createElement("div");
    configuration.classList.add("question-configuration");
    card.appendChild(configuration);
    renderQuestionConfiguration(question,configuration);
    const config=getQuestionType(target.type);
    if(config.hasOptions){
      if(!target.options || target.options.length===0){
        target.options=["Option 1"];
      }
    }else{
      delete target.options;
    }
  });
    renderBuilderOptions(
      question,optionsContainer
    );
  });
  requiredCheckbox.addEventListener("change",function(){
    updateState(function (state){
        const location=findQuestionLocation(state,question.id);
        if(!location){return;}
        location.question.required=requiredCheckbox.checked;
    });
  });
  deleteButton.addEventListener("click",function(){
    deleteQuestion(question.id);
  });
  duplicateButton.addEventListener("click",function(){
    duplicateQuestion(question.id);
  });
  card.addEventListener("dragstart",function (){
   draggedQuestionId=question.id;
   card.classList.add("dragging");
  });
  card.addEventListener("dragend",function (){
    draggedQuestionId=null;
    card.classList.remove("dragging");
    clearDragIndicators();
  });
  card.addEventListener("dragover",function (event){
    event.preventDefault();
    if(draggedQuestionId===question.id){
      return;
    }    
    showDragIndicator(card,event);
  });
  card.addEventListener("drop",function (event){
    event.preventDefault();
    if(!draggedQuestionId || draggedQuestionId===question.id){
      return;
    }
card.addEventListener("dragstart",handleQuestionDragStart);
card.addEventListener("dragend",handleQuestionDragEnd);
card.addEventListener("dragover",handleQuestionDragOver);
card.addEventListener("drop",handleQuestionDrop);
    moveQuestion(draggedQuestionId,question.id,event);
  });
  card.addEventListener("click",
    function (event){
        if(event.target.closest("button, input, textarea, select")){
            return;
        }
        openQuestionInspector(question.id,section.id);
    });
  return card;
}

function renderBuilderQuestion(question,index,section){
  const card=createBuilderQuestion(question,index,section);
  builderQuestions.appendChild(card);
}

updateFlowHealthBadge();

document.addEventListener("keydown",
    function (event){
        if(event.key !== "/"){
            return;
        }
        const active=document.activeElement;
        if(active && (active.tagName==="INPUT" || active.tagName==="TEXTAREA")){
            return;
        }
        const picker=document.getElementById("questionPickerOverlay");
        if(!picker || !picker.hidden){
            return;
        }
        event.preventDefault();
        const firstSection=appState.sections[0];
        if(firstSection){openQuestionPicker(firstSection.id);
        }
    });

let inspectorState={questionId:null,sectionId:null}

function findQuestion(questionId,sectionId){
    const section=appState.sections.find(
      section=>section.id===sectionId);
    if(!section){
        return null;
    }
    return (section.questions.find(
      question=>question.id===questionId) || null);
}

function escapeAttribute(value){
    return escapeHTML(value).replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function renderOptionsInspector(container,question){
    if(!question.options){
        question.options=["Option 1","Option 2","Option 3"];
    }
    container.innerHTML=`<div class="inspector-group">
            <div class="inspector-group-title">Options</div>
            <div id="inspectorOptions" class="inspector-options">
                ${question.options.map((option, index)=>`
                        <div class="inspector-option" data-index="${index}">
                            <i class="fa-solid fa-grip-vertical option-drag"></i>
                            <input type="text" value="${escapeAttribute(option)}"
                                data-option-index="${index}">
                            <button type="button"
                                class="remove-option"
                                data-option-index="${index}"
                                aria-label="Remove option">
                                <i class="fa-solid fa-xmark"></i></button>
                        </div>`).join("")}
            </div>
            <button type="button"
                id="addInspectorOption"
                class="add-option-btn">
                <i class="fa-solid fa-plus"></i>Add option</button>
        </div>`;
}

function renderTypeSpecificInspector(question){
    const container=document.getElementById("typeSpecificInspector");
    if(!container){
        return;
    }
    container.innerHTML="";
    if(["multiple-choice","checkboxes","dropdown"].includes(question.type)){
        renderOptionsInspector(container,question);
    }
    if(question.type==="rating"){
        renderRatingInspector(container,question);
    }
    if(question.type==="linear-scale"){
        renderScaleInspector(container,question);
    }
}

function renderRatingInspector(container,question){
    container.innerHTML=`<div class="inspector-group">
            <div class="inspector-group-title">Rating</div>
            <div class="inspector-field">
                <label>Maximum rating</label>
                <select id="ratingScale">
                    ${[3,4,5,7,10].map(value=>`
                                <option value="${value}"
                                    ${question.scale === value? "selected":""}>
                                    ${value} </option>`).join("")}
                </select>
            </div>
            <div class="inspector-field">
                <label>Rating icon</label>
                <selectid="ratingIcon">
                    <option value="star" ${
                            question.icon==="star"? "selected" : ""}>Stars</option>
                    <option value="heart" ${question.icon==="heart"?"selected":""}>
                        Hearts</option>
                    <option value="smile" ${
                            question.icon==="smile"?"selected":""}>Smiley</option>
                </selectid=></div>
        </div>`;
}

function renderScaleInspector(container,question){
    container.innerHTML=`<div class="inspector-group">
            <div class="inspector-group-title">Scale</div>
            <div class="inspector-field"><label>Minimum</label>
                <input id="scaleMin"
                    type="number"
                    value="${question.min ?? 1}"></div>
            <div class="inspector-field">
                <label> Maximum</label>
                <input id="scaleMax"
                    type="number"
                    value="${question.max ?? 5}" > </div>
        </div>`;
}

function attachInspectorListeners(){
    const title=document.getElementById("inspectorQuestionTitle");
    const description=document.getElementById("inspectorQuestionDescription");
    const type=document.getElementById("inspectorQuestionType");
    const required=document.getElementById("inspectorRequired");
    title?.addEventListener("input",
        function (){updateCurrentQuestion(
                {title:title.value});
        });
    description?.addEventListener("input",
        function (){updateCurrentQuestion(
                {description:description.value});
        });
    type?.addEventListener("change",
        function (){changeQuestionType(type.value);
        });
    required?.addEventListener("change",
        function (){updateCurrentQuestion(
                {required:required.checked
                });
        });
    attachOptionListeners();
    attachRatingListeners();
    attachScaleListeners();
}

document.getElementById("openLogicBuilder")?.addEventListener(
    "click",openLogicBuilder
    );

function renderQuestionInspector(question){
    const body=document.getElementById("questionInspectorBody");
    body.innerHTML=`<div class="inspector-group">
            <div class="inspector-group-title">Content</div>
            <div class="inspector-field">
                <label>Question</label>
                <input id="inspectorQuestionTitle"
                    type="text"
                    value="${escapeAttribute(question.title)}">
            </div>
            <div class="inspector-field">
                <label> Description</label>
                <textarea id="inspectorQuestionDescription">${escapeHTML(
                    question.description || ""
                )}</textarea></div></div>
        <div class="inspector-group">
            <div class="inspector-group-title">Question type</div>
            <div class="inspector-field">
                <select id="inspectorQuestionType">
                    ${QUESTION_TYPES.map(item=>`
                            <option value="${item.type}"
                                ${item.type===question.type
                                        ?"selected":""}>
                                ${escapeHTML(item.label)}</option>`).join("")}
                </select></div></div>
        <div id="typeSpecificInspector"></div>
        <div class="inspector-group">
            <div class="inspector-group-title">Behavior</div>
            <div class="inspector-toggle">
                <div>
                    <strong>Required</strong>
                    <span>Respondents must answer this question.</span>
                </div>
                <label class="switch">
                    <input id="inspectorRequired"type="checkbox"
                        ${question.required?"checked":""}>
                    <span class="switch-slider"></span></label>
            </div>
        </div>`;
    renderTypeSpecificInspector(question);
    attachInspectorListeners();
  }

function openQuestionInspector(questionId,sectionId){
    const question=findQuestion(questionId,sectionId);
    if(!question){
        return;
    }
    inspectorState.questionId=questionId;
    inspectorState.sectionId=sectionId;
    console.log("Inspector open:",{
      questionId:inspectorState.questionId,
      sectionId:inspectorState.sectionId
    });
    renderQuestionInspector(question);
    const inspector=document.getElementById("questionInspector");
    const backdrop=document.getElementById("inspectorBackdrop");
    inspector.classList.add("open");
    inspector.setAttribute("aria-hidden","false");
    backdrop.hidden=false;
    document.body.classList.add("inspector-open");
}

function closeQuestionInspector(){
    const inspector=document.getElementById("questionInspector");
    const backdrop=document.getElementById("inspectorBackdrop");
    inspector.classList.remove("open");
    inspector.setAttribute("aria-hidden","true");
    backdrop.hidden=true;
    inspectorState.questionId=null;
    inspectorState.sectionId=null;
    document.body.classList.remove("inspector-open");
}

document.getElementById("closeQuestionInspector").addEventListener("click",closeQuestionInspector);
document.getElementById("inspectorBackdrop").addEventListener("click",closeQuestionInspector);

function duplicateQuestion(questionId,sectionId){
    const section=appState.sections.find(
            function (item){
                return (item.id===sectionId);
            });
    if(!section){
        return;
    }
    const index=section.questions.findIndex(
            function (question){
                return (question.id===questionId);
            });
    if(index===-1){
        return;
    }
    pushHistory();
    const original=section.questions[index];
    const copy=structuredClone(original);
    copy.id=crypto.randomUUID();
    copy.title=`${original.title} (Copy)`;
    section.questions.splice(index + 1,0,copy);
    scheduleSave();
    renderApp();
    updateHistoryButtons();
}

function addQuestionToSection(sectionId){
    const section=appState.sections.find(item=>item.id===sectionId);
    if(!section){
        return;
    }
    pushHistory();
    const question={
      id:crypto.randomUUID(),
      type:"short-answer",
      title:"Untitled question",
      description:"",
      required:false
    };
    section.questions.push(question);
    scheduleSave();
    renderApp();
    updateHistoryButtons();
    openQuestionInspector(question.id,sectionId);
}

function deleteSection(sectionId){
    if(appState.sections.length<=1){
        alert("A form must contain at least one section.");
        return;
    }
    const section=appState.sections.find(
            function (item){
                return (item.id===sectionId);
            });
    if(!section){
        return;
    }
    const confirmed=confirm(`Delete "${section.title}"?`);
    if(!confirmed){
        return;
    }
    pushHistory();
    appState.sections=appState.sections.filter(
            function (item){
                return (item.id!==sectionId);
            });
    scheduleSave();
    renderApp();
    updateHistoryButtons();
}

function editSection(sectionId){
    const section=appState.sections.find(
            function (item){
                return (item.id ===sectionId);
            });
    if(!section){
        return;
    }
    const title=prompt("Section title:",section.title);
    if(title === null){
        return;
    }
    const cleanTitle=title.trim();
    if(!cleanTitle){
        alert("Section title cannot be empty.");
        return;
    }
    pushHistory();
    section.title=cleanTitle;
    scheduleSave();
    renderApp();
}

function createSection(title="New section"){
    return {
        id:crypto.randomUUID(),title,
        description: "",
        questions: [],
        navigation:{
            type:"next",
            target:null
        }};
}

function renderSectionQuestions(sectionElement,section,index){
    const container=sectionElement.querySelector(".section-questions");
    section.questions.forEach(
        function (question,questionIndex){
            const questionElement=createBuilderQuestion(
              question,questionIndex,section);
            container.appendChild(questionElement);
        });
}

document.getElementById("builderSections").addEventListener("click",
        function (event){
            const button=event.target.closest("button");
            if(!button){
                return;
            }
            const sectionElement=button.closest(".builder-section");
            if(!sectionElement){
                return;
            }
            const sectionId=sectionElement.dataset.sectionId;
            const action=button.dataset.action;
            handleSectionAction(action,sectionId);
        });

function createFormDocument(){
  return{
    version:1,
    id:appState.form.id || crypto.randomUUID(),
    createdAt:appState.form.createdAt || new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    form:{
    title:appState.form.title,
    description:appState.form.description,
    theme:appState.form.theme,
    style:structuredClone(appState.form.style)
    },
    sections:structuredClone(appState.sections)
  };
}

const THEMES={
  classic:{
    label:"Classic",
    primary:"#673ab7",
    accent:"#9c27b0",
    background:"#f5f5f5",
    surface:"#ffffff",
    text:"#202124",
    muted:"#5f6368",
    border:"#dadce0"
  },
  ocean:{
    label:"Ocean",
    primary:"#0077b6",
    accent:"#00b4d8",
    background:"#eef9fc",
    surface:"#ffffff",
    text:"#12303b",
    muted:"#52727d",
    border:"#c7e7ee"
  },
  sunset:{
    label:"Sunset",
    primary:"#e85d04",
    accent:"#f48c06",
    background:"#fff6ed",
    surface:"#ffffff",
    text:"#35200f",
    muted:"#795548",
    border:"#f0d4bd"
  },
  forest:{
    label:"Forest",
    primary:"#2d6a4f",
    accent:"#40916c",
    background:"#f1f8f4",
    surface:"#ffffff",
    text:"#19352a",
    muted:"#587467",
    border:"#cde3d7"
  },

  midnight:{
    label:"Midnight",
    primary:"#7c4dff",
    accent:"#bb86fc",
    background:"#121212",
    surface:"#1e1e1e",
    text:"#f5f5f5",
    muted:"#bdbdbd",
    border:"#383838"
  },
  minimal:{
    label:"Minimal",
    primary:"#202124",
    accent:"#5f6368",
    background:"#fafafa",
    surface:"#ffffff",
    text:"#202124",
    muted:"#6b7280",
    border:"#e5e7eb"
  }
};

const FORM_STYLES={
  layout:{
    compact:{
      label:"Compact",
      spacing:"12px"
    },
    comfortable:{
      label:"Comfortable",
      spacing:"20px"
    },
    spacious:{
      label:"Spacious",
      spacing:"32px"
    }
  },
  card:{
    flat:{
      label:"Flat"
    },
    soft:{
      label:"Soft"
    },
    elevated:{
      label:"Elevated"
    }
  },
  corners:{
    sharp:{
      label:"Sharp",
      radius:"3px"
  },
  rounded:{
    label:"Rounded",
    radius:"10px"
  },
  pill:{
    label:"Pill",
    radius:"20px"
  }
},
animation:{
  none:{
    label:"None"
  },
  subtle:{
    label:"Subtle"
  },
  lively:{
    label:"Lively"
  }
},
numbering:{
  none:{
    label:"None"
  },
  numbers:{
    label:"Numbers"
  },
  progress:{
    label:"Progress"
  }
},
background:{
  solid:{
    label:"Solid"
  },
  pattern:{
    label:"Pattern"
  }
}
};

function applyFormStyle(){
  const style=appState.form.style;
  const root=document.documentElement;
  const layout=FORM_STYLES.layout[style.layout];
  if(layout){
    root.style.setProperty("--question-spacing",layout.spacing);
  }
  const corners=FORM_STYLES.corners[style.corners];
  if(corners){
    root.style.setProperty("--card-radius",corners.radius);
  }
  root.dataset.cardStyle=style.card;
  root.dataset.animation=style.animation;
  root.dataset.numbering=style.numbering;
  root.dataset.background=style.background;
}

function createStyleSelect(labelText,property,container){
  const group=document.createElement("div");
  group.classList.add("configuration-group");
  const label=document.createElement("label");
  label.textContent=labelText;
  const select=document.createElement("select");
  const values=FORM_STYLES[property];
  Object.entries(values).forEach(function ([id,option]){
    const element=document.createElement("option");
    element.value=id;
    element.textContent=option.label;
    element.selected=appState.form.style[property]===id;
    select.appendChild(element);
  });
  select.addEventListener("change",function (){
    appState.form.style[property]=select.value;
    applyFormStyle();
  });
  group.appendChild(label);
  group.appendChild(select);
}

function renderStyleOptions(){
  const container=document.getElementById("styleOptions");
  if(!container){
    return ;
  }
  container.innerHTML="";
  createStyleSelect("Layout","layout",container);
  createStyleSelect("Card style","card",container);
  createStyleSelect("Corners","corners",container);
  createStyleSelect("Animation","animation",container);
  createStyleSelect("Question numbering","numbering",container);
  createStyleSelect("Backgound","background",container);
}

function applyTheme(themeName){
  const theme=THEMES[themeName];
  if(!theme){
    console.warn("Unknown theme:",themeName);
    return;
  }
  const root=document.documentElement;
  root.style.setProperty("--primary",theme.primary);
  root.style.setProperty("--accent",theme.accent);
  root.style.setProperty("--background",theme.background);
  root.style.setProperty("--surface",theme.surface);
  root.style.setProperty("--text",theme.text);
  root.style.setProperty("--muted",theme.muted);
  root.style.setProperty("--border",theme.border);
}

applyTheme(appState.form.theme);
applyFormStyle();
renderThemeOptions();
renderStyleOptions();

function renderThemeOptions(){
  const container=document.getElementById("themeOptions");
  if(!container){
    return;
  }
  container.innerHTML="";
  Object.entries(THEMES).forEach(function ([id,theme]){
    const button=document.createElement("button");
    button.type="button";
    button.classList.add("theme-option");
    if(appState.form.theme===id){
      button.classList.add("selected");
    }
    button.style.setProperty("--theme-primary",theme.primary);
    button.innerHTML=`<span class="theme-preview"><span></span>
    <span></span></span>
    <span class="theme-name">${theme.label}</span>`;
    button.addEventListener("click",function (){
      updateState(function (state){
        state.form.theme=id;
      });
      applyTheme(id);
      renderThemeOptions();
    });
    container.appendChild(button);
  });
}

renderThemeOptions();

renderAllBuilderQuestions();

function getDefaultQuestionConfig(type){
  switch(type){
    case "rating":
      return{
        scale:5,
        icon:"star",
        minLabel:"",
        maxLabel:""
      };
    case "linear-scale":
      return{
        min:1,
        max:5,
        minLabel:"",
        maxLabel:""
      };
      default:
        return{};
  }
}

function initializeApplication(){
const restored=loadForm();
  applyTheme(appState.form.theme);
  applyFormStyle();
  renderApp();
  renderThemeOptions();
  renderStyleOptions();
  if(restored){
    showSaveStatus("Restored");
  }
}

function renderFormBuilder(){
  builderQuestions.innerHTML="";
  renderSections();
}

const previewHeader=document.getElementById("previewHeader");
function escapeHTML(value){
  const div=document.createElement("div");
  div.textContent=value??"";
  return div.innerHTML;
}

function renderFormPreview(){
  previewHeader.innerHTML=`
  <h1>${escapeHTML(appState.form.title)}
  </h1>
  <p>${escapeHTML(appState.form.description)}
  </p>`;
  dynamicQuestions.innerHTML="";
  let questionIndex=0;
  appState.sections.forEach(function (section){
    section.questions.forEach(function (question){
    const element=renderQuestion(question,questionIndex);
    if(element){
      dynamicQuestions.appendChild(element);
    }
    questionIndex++;
  });
});
}

function initializeQuestionState(){
  appState.sections.forEach(
    function (section){
        section.questions.forEach(function (question){
      if(!questionState[question.id]){
        questionState[question.id]={touched:false};
      }
    }
  );
});
}

const previewSubmitContainer=document.getElementById("previewSubmitContainer");
const previewSubmitBtn=document.getElementById("previewSubmitBtn");
previewSubmitBtn.addEventListener("click",function (){
  const valid=validateForm();
  if(!valid){
    return;
  }
  const responses=collectResponses();
  console.log("Preview submission:");
  console.log(responses);
});

function updateModeUI(){
  const isBuilder=appState.mode==="builder";
  builderModeBtn.classList.toggle("active",isBuilder);
  previewModeBtn.classList.toggle("active",!isBuilder);
}

function renderBuilderMode(){
  builderQuestions.style.display="block";
  dynamicQuestions.style.display="none";
  previewHeader.style.display="none";
  previewSubmitContainer.style.display="none";
  document.querySelector(".builder-header").style.display="block";
  document.querySelector(".add-question-container").style.display="flex";
  renderFormBuilder();
}

function renderPreviewMode(){
  builderQuestions.style.display="none";
  dynamicQuestions.style.display="block";
  previewHeader.style.display="block";
  previewSubmitContainer.style.display="flex";
  document.querySelector(".builder-header").style.display="none";
  document.querySelector(".add-question-container").style.display="none";
  renderFormPreview();
}

let saveTimer=null;

function scheduleSave(){
  clearTimeout(saveTimer);
  showSaveStatus("Saving");
  saveTimer=setTimeout(function (){
    saveForm();
  },500);
}

function updateState(callback){
  pushHistory();
  callback(appState);
  appState.form.updatedAt=new Date().toISOString();
  scheduleSave();
  renderApp();
}

function renderMode(){
  const builder=document.getElementById("builderView");
  const respondent=document.getElementById("respondentView");
  if(!builder || !respondent){
    return;
  }
  const isBuilder=appState.mode==="builder";
  builder.hidden=!isBuilder;
  respondent.hidden=isBuilder;
  document.getElementById("builderModeBtn")?.classList.toggle(
    "active",isBuilder
  );
  document.getElementById("respondentModeBtn")?.classList.toggle(
    "active",!isBuilder
  );
  if(!isBuilder){
    renderRespondentMode();
  }
  document.getElementById("builderModeBtn").addEventListener(
    "click",function (){
      appState.mode="builder";
    }
  );
  document.getElementById("respondentModeBtn").addEventListener(
    "click",function (){
      appState.mode="respondent";
      appState.responses={};
      appState.respondent.currentQuestion=0;
      appState.respondent.completed=false;
      renderMode();
    }
  );
}

function validateQuestion(question){
  const questionElement=document.querySelector(
    `#dynamicQuestions .form-question[data-question-id="${question.id}"]`);
  if(!questionElement){
    return{
      valid:false,
      message:"Question could not be found."
    };
  }
  const responses=collectResponses();
  const answer=responses[question.id];
  const isEmpty=answer===null || answer===undefined || answer==="" || 
  (Array.isArray(answer) && answer.length===0);
  if(question.required && isEmpty){
    return {
      valid:false,
      message:"This question is required."
    };
  }
  if(isEmpty){
    return {
      valid:true,
      message:""
    };
  }
  if(typeof answer==="string"){
    if(question.minLength!=null && answer.length<question.minLength){
      return {
        valid:false,
        message:`Please enter at least ${question.minLength} characters.`
      };
    }
    if(question.maxLength!=null && answer.length>question.maxLength){
      return {
        valid:false,
        message:`Please enter no more than ${question.maxLength} characters.`
      };
    }
  }
  if(question.type==="email"){
    const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailPattern.test(answer)){
      return{
        valid:false,
        message:"Please enter a valid email address."
      };
    }
  }
  if(question.type==="checkboxes" && Array.isArray(answer)){
    if(question.minSelections!=null && answer.length<question.minSelections){
      return{
        valid:false,
        message:`Please select at least ${question.minSelections} option(s).`
      };
    }
    if(question.maxSelections!=null && answer.length>question.maxSelections){
      return{
        valid:false,
        message:`Please select no more than ${question.maxSelections} option(s).`
      };
    }
  }
  return{
    valid:true,
    message:""
  };
}

function validateForm(){
  let formIsValid=true;
  let firstInvalidQuestion=null;
  appState.sections.forEach(function (section){
    section.questions.forEach(function (question){
      if(!questionState[question.id]){
        questionState[question.id]={
          touched:false
        };
      }
    questionState[question.id].touched=true;
    const result=validateQuestion(question);
    const questionElement=document.querySelector(
      `#dynamicQuestions .form-question[data-question-id="${question.id}"]`
    );
    if(!result.valid){
      formIsValid=false;
      showQuestionError(question,result.message);
      if(!firstInvalidQuestion && questionElement){
        firstInvalidQuestion=questionElement;
      }
    }
  else{
    clearQuestionError(question);
  }
});
  });
  if(firstInvalidQuestion){
    firstInvalidQuestion.scrollIntoView({
      behavior:"smooth",
      block:"center"
    });
    }
    return formIsValid;
  }

function collectResponses(){
  const responses={};
  const questionElements=document.querySelectorAll("#dynamicQuestions .form-question");
  questionElements.forEach(function (questionElement){
    const questionId=questionElement.dataset.questionId;
    if(!questionId){return;}
    const inputs=questionElement.querySelectorAll("input,textarea,select");
    if(inputs.length===0){
      if(appState.responses && Object.prototype.hasOwnProperty.call(
        appState.responses,questionId)){
          responses[questionId]=appState.responses[questionId];
      }
      return;
    }
    const firstInput=inputs[0];
    if(firstInput.type==="checkbox"){
      const values=[];
      inputs.forEach(function (input){
        if(input.checked){
          values.push(input.value);
        }
      });
      responses[questionId]=values;
    }
    else if(firstInput.type==="radio"){
      const selected=questionElement.querySelector(
        'input[type="radio"]:checked');
      responses[questionId]=selected
      ?selected.value:null;
    }
    else if(
      firstInput.tagName==="SELECT"){
      responses[questionId]=firstInput.value;
    }
    else if(firstInput.tagName==="TEXTAREA"){
      responses[questionId]=firstInput.value.trim();
    }
    else{responses[questionId]=firstInput.value.trim();}
  });
  return responses;
}

function setRating(questionId,value,container,question){
  if(!appState.responses){
    appState.responses={};
  }
  appState.responses[questionId]=value;
  const iconType=question.icon || "star";
  const icon=RATING_ICONS[iconType] || RATING_ICONS.star;
  const buttons=container.querySelectorAll(".rating-star");
  buttons.forEach(function (button,index){
    const ratingValue=index+1;
    const iconClass=ratingValue<=value?icon.filled:icon.empty;
   button.innerHTML=`<i class="${iconClass}"></i>`;
   button.classList.toggle("selected",ratingValue<=value);
  });
}

const dynamicQuestions=document.getElementById("dynamicQuestions");

function renderTextQuestion(question,wrapper){
  const input=createQuestionInput("text",question);
  wrapper.appendChild(input);
}

function renderTextareaQuestion(question,wrapper){
  const textarea=document.createElement("textarea");
  textarea.classList.add("question-input");
  textarea.placeholder=question.placeholder || "Your answer";
  textarea.dataset.questionId=question.id;
  wrapper.appendChild(textarea);
}

function renderEmailQuestion(question,wrapper){
  const input=createQuestionInput("email",question);
  wrapper.appendChild(input);
}

function renderNumberQuestion(question,wrapper){
  const input=createQuestionInput("number",question);
  wrapper.appendChild(input);
}

function renderDateQuestion(question,wrapper){
  const input=createQuestionInput("date",question);
  wrapper.appendChild(input);
}

function renderTimeQuestion(question,wrapper){
  const input=createQuestionInput("time",question);
  wrapper.appendChild(input);
}

function renderMultipleChoiceQuestion(question,wrapper){
  const optionsContainer=document.createElement("div");
  optionsContainer.classList.add("question-options");
  (question.options || []).forEach(function (option,index){
    const label=document.createElement("label");
    label.classList.add("question-option");
    const input=document.createElement("input");
    input.type="radio";
    input.name=`question-${question.id}`;
    input.value=option;
    input.dataset.questionId=question.id;
    const text=document.createElement("span");
    text.textContent=option;
    label.appendChild(input);
    label.appendChild(text);
    optionsContainer.appendChild(label);
    wrapper.appendChild(optionsContainer);
  });
}

function renderCheckboxQuestion(question,wrapper){
  const optionsContainer=document.createElement("div");
  optionsContainer.classList.add("question-options");
  (question.options || []).forEach(function (option){
    const label=document.createElement("label");
    label.classList.add("question-option");
    const input=document.createElement("input");
    input.type="checkbox";
    input.value=option;
    input.dataset.questionId=question.id;
    const text=document.createElement("span");
    text.textContent=option;
    label.appendChild(input);
    label.appendChild(text);
    optionsContainer.appendChild(label);
    wrapper.appendChild(optionsContainer);
  });
}

function renderDropdownQuestion(question,wrapper){
  const select=document.createElement("select");
  select.classList.add("question-input");
  select.dataset.questionId=question.id;
  const placeholder=document.createElement("option");
  placeholder.value="";
  placeholder.textContent="Choose an option";
  placeholder.disabled=true;
  placeholder.selected=true;
  select.appendChild(placeholder);
  (question.options || []).forEach(function (option){
    const optionElement=document.createElement("option");
    optionElement.value=option;
    optionElement.textContent=option;
    select.appendChild(optionElement);
  });
    wrapper.appendChild(select);
}

const RATING_ICONS={
  star:{
    empty:"fa-regular fa-star",
    filled:"fa-solid fa-star"
  },
  heart:{
    empty:"fa-regular fa-heart",
    filled:"fa-solid fa-heart"
  },
  thumb:{
    empty:"fa-regular fa-thumbs-up",
    filled:"fa-solid fa-thumbs-up"
}
};

function renderRatingQuestion(question,wrapper){
  const ratingArea=document.createElement("div");
  ratingArea.classList.add("rating-area");
  if(question.minLabel){
    const minLabel=document.createElement("span");
    minLabel.classList.add("rating-label");
    minLabel.textContent=question.minLabel;
    ratingArea.appendChild(minLabel);
  }
  const ratingContainer=document.createElement("div");
  ratingContainer.classList.add("rating-container");
  const scale=question.scale || 5;
  const iconType=question.icon || "star";
  const icon=RATING_ICONS[iconType] || RATING_ICONS.star;
  for(let i=1;i<=scale;i++){
    const button=document.createElement("button");
    button.type="button";
    button.classList.add("rating-star");
    button.dataset.value=i;
    const iconElement=document.createElement("i");
    iconElement.className=icon.empty;
    button.appendChild(iconElement);
    button.addEventListener("click",function (){
      setRating(question.id,i,ratingContainer,question);
    });
    ratingContainer.appendChild(button);
  }
  ratingArea.appendChild(ratingContainer);
  if(question.maxLabel){
    const maxLabel=document.createElement("span");
    maxLabel.classList.add("rating-label");
    maxLabel.textContent=question.maxLabel;
    ratingArea.appendChild(maxLabel);
  }
  wrapper.appendChild(ratingArea);
}

function createScaleNumberInput(labelText,value,callback,container){
  const group=document.createElement("div");
  group.classList.add("configuration-group");
  const label=document.createElement("label");
  label.textContent=labelText;
  const input=document.createElement("input");
  input.type="number";
  input.value=value;
  input.addEventListener("change",function (){
    callback(Number(input.value));
  });
  group.appendChild(label);
  group.appendChild(input);
  container.appendChild(group);
}

function createScaleTextInput(labelText,value,callback,container){
  const group=document.createElement("div");
  group.classList.add("configuration-group");
  const label=document.createElement("label");
  label.textContent=labelText;
  const input=document.createElement("input");
  input.type="text";
  input.value=value || "";
  input.placeholder="Optional";
  input.addEventListener("input",function (){
    callback(input.value);
  });
  group.appendChild(label);
  group.appendChild(input);
  container.appendChild(group);
}

function updateQuestionValue(questionId,property,value){
  updateState(function (state){
    const question=state.questions.find(
      q=>q.id===questionId
    );
    if(!question){
      return;
    }
    question[property]=value;
  });
}

function renderScaleConfiguration(question,container){
  const title=document.createElement("div");
  title.classList.add("configuration-title");
  title.textContent="Linear state settings";
  container.appendChild(title);
  createScaleNumberInput("Minimum",question.min,
    function (value){
      updateQuestionValue(question.id,"min",value);
    },
    container
  );
  createScaleNumberInput("Maximum",question.max,
    function (value){
      updateQuestionValue(question.id,"max",value);
    },
    container
  );
  createScaleTextInput("Minimum label",question.minLabel,
    function (value){
      updateQuestionValue(question.id,"minLabel",value);
    },
    container
  );
  createScaleTextInput("Maximum label",question.maxLabel,
    function (value){
      updateQuestionValue(question.id,"maxLabel",value);
    },
    container
  );
}

function createQuestionInput(
  type,question
){
  const input=document.createElement("input");
  input.type=type;
  input.classList.add("question-input");
  if(question.placeholder){
    input.placeholder=question.placeholder;
  }
  input.dataset.questionId=question.id;
  return input;
}

const QUESTION_RENDERERS={
  text:renderTextQuestion,
  "short-answer":renderTextQuestion,
  "paragraph":renderTextareaQuestion,
  "linear-scale":renderLinearScaleQuestion,
  textarea:renderTextareaQuestion,
  email:renderEmailQuestion,
  number:renderNumberQuestion,
  "multiple-choice":renderMultipleChoiceQuestion,
  checkboxes:renderCheckboxQuestion,
  dropdown:renderDropdownQuestion,
  date:renderDateQuestion,
  time:renderTimeQuestion,
  rating:renderRatingQuestion
};

function  renderQuestion(question,index=0){
  const wrapper=document.createElement("div");
  wrapper.classList.add("form-question");
  wrapper.dataset.questionId=question.id;
  const title=document.createElement("div");
  title.classList.add("question-title");
  const questionNumber=document.createElement("span");
  questionNumber.classList.add("question-number");
  questionNumber.textContent=`${index+1}`;
  const titleText=document.createElement("span");
  titleText.textContent=question.title || "Untitled question";
  title.appendChild(questionNumber);
  title.appendChild(titleText);
  title.prepend(questionNumber);
  if(question.required){
    const required=document.createElement("span");
    required.classList.add("required-indicator");
    required.textContent="*";
    required.setAttribute("aria-label","Required");
    title.appendChild(required);
    }
    wrapper.appendChild(title);
    const renderer=QUESTION_RENDERERS[question.type];
    if(renderer){
      renderer(question,wrapper);
      }
    else{
      console.warn("Unknown question type:",question.type);
    }
    const errorElement=document.createElement("div");
    errorElement.classList.add("question-error");
    errorElement.dataset.errorFor=question.id;
    errorElement.setAttribute("role","alert");
    errorElement.setAttribute("aria-live","polite");
    wrapper.appendChild(errorElement);
    return wrapper;
  }


const progressBar=document.getElementById("progressBar");
const progressText=document.getElementById("progressText");
const progressPercentage=document.getElementById("progressPercentage");
function updateProgress(){
  const questions=document.querySelectorAll("#googleForm [data-question]");
  let answeredQuestions=0;
  const totalQuestions=questions.length;
  questions.forEach(function (question){
    const inputs=question.querySelectorAll("input,textarea,select");
    let answered=false;
    inputs.forEach(function (input){
      if(input.type==="radio" || input.type==="checkbox"){
        if(input.checked){
          answered=true;
        }
      }
      else if(input.value.trim() !==""){
          answered=true;
        }
    });
    if(answered){
      answeredQuestions++;
    }
});
const percentage=totalQuestions>0?Math.round((
  answeredQuestions/totalQuestions)*100):0;
  progressText.textContent=`${answeredQuestions} of ${totalQuestions} questions answered`;
  progressPercentage.textContent=`${percentage}%`;
  progressBar.style.width=`${percentage}%`;
}

   appState.sections.forEach(function (section){
    section.questions.forEach(function (question){
  const element=renderQuestion(question);
  if(element){
    dynamicQuestions.appendChild(element);
  }
});
  });

function showQuestionError(question,message){
  const questionElement=document.querySelector(
    `[data-question-id="${question.id}"]`
  );
  if(!questionElement){
    return;
  }
  const errorElement=questionElement.querySelector(
    `[data-error-for="${question.id}"]`
  );
  if(!errorElement){
    return;
  }
  errorElement.textContent=message;
  questionElement.classList.add(
    "has-error"
  );
  
}

function clearQuestionError(question){
  const questionElement=document.querySelector(
    `[data-question-id="${question.id}"]`
  );
  if(!questionElement){
    return;
  }
  const errorElement=questionElement.querySelector(
    `[data-error-for="${question.id}"]`
  );
  if(!errorElement){
    return;
  }
  errorElement.textContent="";
  questionElement.classList.remove(
    "has-error"
  );
}

function validateSingleQuestion(question){
  const state=questionState[question.id];
  if(!state || !state.touched){
    return true;
  }
  const result=validateQuestion(question);
  const questionElement=document.querySelector(
    `[data-question-id="${question.id}"]`
  );
  if(result.valid){
    clearQuestionError(question);
    questionElement.classList.add("is-valid");
  }
  else{
    showQuestionError(
      question,result.message
    );
    questionElement.classList.remove("is-valid");
  }
  return result.valid;
}

const questionState={};

function setupLiveValidation(){
    appState.sections.forEach(function (section){
    section.questions.forEach(function (question){
    const element=document.querySelector(
    `[data-question-id="${question.id}"]`
  );
  if(!element){
    return;
  }
  questionState[question.id]={touched:false};
  setupQuestionValidation(question,element);
  });
});
}

  let answeredQuestions=0;
  const totalQuestions=questions.length;
  const percentage=Math.round(
    (answeredQuestions/totalQuestions)*100
  );
  progressBar.style.width=`${percentage}%`;
  progressPercentage.textContent=`${percentage}%`;
  progressText.textContent=`${answeredQuestions} of ${totalQuestions} questions answered`;

form.addEventListener("input",updateProgress);
form.addEventListener("change",updateProgress);

function clearError(input,errorElement){
  input.classList.remove("input-error");
  errorElement.textContent="";
}
function showError(input,errorElement,message){
  input.classList.add("input-error");
  errorElement.textContent=message;
}
function isValidEmail(email){
  const emailPattern=/^[^\@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

form.addEventListener("submit",
  function (event){
    event.preventDefault();
    const valid=validateForm();
    if(!valid){
      return;
    }

    const response=collectResponses();

    console.log("Form submitted successfully!");
    console.log(response);
    form.style.display="none";
    successScreen.style.display="block";
  }
);

submitAnother.addEventListener("click", function() {
     form.reset();
     updateProgress();
     successScreen.style.display="none";
     form.style.display="block";
     window.scrollTo({
      top:0,
      behavior:"smooth"
     });
});

function setupQuestionValidation(question,questionElement){
  const inputs=questionElement.querySelectorAll(
    "input,textarea,select"
  );
  inputs.forEach(function (input){
    input.addEventListener("input",function(){
      questionState[question.id].touched=true;
      validateSingleQuestion(question);
    });
  });
}

function renderSingleQuestion(question){
  const element=renderQuestion(question);
  if(!element){
    return;
  }
  dynamicQuestions.appendChild(element);
  questionState[question.id]={
    touched:false
  };
  setupQuestionValidation(
    question,element
  );
}

function generateQuestionId(){
  return(
    "q_"+Date.now()+"_"+Math.random().toString(36).substring(2,8)
  );
}

function addNewQuestion(){
  const newQuestion={
    id:generateQuestionId(),
    type:"text",
    title:"Untitled question",
    placeholder:"Your answer",
    required:false
  };
  updateState(function (state){  
    state.sections[0].questions.push(
      newQuestion
    );
  });
}

addQuestionBtn.addEventListener("click", addNewQuestion);

function getQuestionType(type){
  return QUESTION_TYPES.find(questionType=>
        questionType.type===type) || QUESTION_TYPES.find(questionType=>
            questionType.type==="short-answer") || null;
}

function findQuestionLocation(state,questionId){
    if(!state || !Array.isArray(state.sections)){
        return null;
    }
    for(const section of state.sections){
        if(!Array.isArray(section.questions)){continue;}
        const questionIndex=section.questions.findIndex(
            function (question){
                return question.id===questionId;
    });
        if(questionIndex!==-1){
            return {
                section:section,question:
                section.questions[questionIndex],
                questionIndex:questionIndex
        };
    }}
    return null;
}

function getSectionByQuestionId(state,questionId){
    return (state.sections || []).find( 
      function (section){
        return (section.questions || []).some(
          function (question){
            return question.id===questionId;
      });
}) || null;
}

function renderBuilderOptions(question,container){
  container.innerHTML="";
  const config=getQuestionType(question.type);
  if(!config || !config.hasOptions){
    return;
  }
  if(!question.options){
    question.options=["Option 1"];
  }
  const heading=document.createElement("p");
  heading.textContent="Options";
  heading.classList.add("options-heading");
  container.appendChild(heading);
  question.options.forEach(function (option,index){
    const row=document.createElement("div");
    row.classList.add("builder-option-row");
    const input=document.createElement("input");
    input.type="text";
    input.value=option;
    input.addEventListener("input",function (){
    updateState(function (state){
      const location=findQuestionLocation(state,question.id);
      if(!location){return;}
      location.question.options[index]=input.value;
      });
    });
    const removeButton=document.createElement("button");
    removeButton.type="button";
    removeButton.textContent="x";
    removeButton.addEventListener(
      "click",function (){
        question.options.splice(index,1);
        renderBuilderOptions(question,container);
      }
    );
    row.appendChild(input);
    row.appendChild(removeButton);
    container.appendChild(row);
  });
  const addOptionButton=document.createElement("button");
  addOptionButton.type="button";
  addOptionButton.textContent="+ Add option";
  addOptionButton.addEventListener("click",function (){
    question.options.push(
      `option ${question.options.length+1}`
    );
    renderBuilderOptions(question,container);
  });
  container.appendChild(addOptionButton);
}

function deleteQuestion(questionId){
  updateState(function (state){
    const location=findQuestionLocation(state,questionId);
    if(!location){return;}
    location.section.questions.splice(location.questionIndex,1);
    });
}

function duplicateQuestion(questionId){
  updateState(function (state){
    const location=findQuestionLocation(state,questionId);
    if(!location){return;}
    const original=location.question;
    const duplicate=structuredClone(original);
    duplicate.id=crypto.randomUUID();
    if(duplicate.title){
        duplicate.title=`${duplicate.title} (Copy)`;
    }
    location.section.questions.splice(
        location.questionIndex+1,0,duplicate
    );
    });
}

function showDragIndicator(card,event){
  clearDragIndicators();
  const rect=card.getBoundingClientRect();
  const middle=rect.top+rect.height/2;
  if(event.clientY<middle){
    card.classList.add("drag-over-before");
  }
  else{
    card.classList.add("drag-over-after");
  }
}

function clearDragIndicators(){
  document.querySelectorAll(".drad-over-before,.drag-over-after").forEach(
    function (element){
      element.classList.remove(".drag-over-before",".drag-over-after");
    }
  );
}

function createRatingSelect(
  labelText,currentValue,values,callback,container,formatter=null
){
  const group=document.createElement("div");
  group.classList.add("configuration-group");
  const label=document.createElement("label");
  label.textContent=labelText;
  const select=document.createElement("select");
  values.forEach(function (value){
    const option=document.createElement("option");
    option.value=value;
    option.textContent=formatter?formatter(value):value;
    option.selected=value===currentValue;
    select.appendChild(option);
  });
  select.addEventListener("change",function (){
    callback(select.value);
  });
  group.appendChild(label);
  group.appendChild(select);
  container.appendChild(group);
}

function renderRatingConfiguration(question,container){
  container.innerHTML="";
  const title=document.createElement("div");
  title.classList.add("configuration-title");
  title.textContent="Rating setting";
  container.appendChild(title);
  createRatingSelect("Scale",question.scale || 5,[3,4,5,6,7,8,9,10],
    function (value){
      updateQuestionValue(question.id,"scale",Number(value));
    },
    container
  );

  const iconValues=Object.keys(RATING_ICONS);
  createRatingSelect("Icon",question.icon || "star",
    iconValues,function (value){
      updateQuestionValue(question.id,"icon",value);
    },
    container,function (value){
      return RATING_ICONS[value].label;
    }
  );

  createScaleTextInput("Minimum label",question.minLabel,function (value){
    updateQuestionValue("minLabel",value);
  },container);
  createScaleTextInput("Maximum label",question.maxLabel,function (value){
    updateQuestionValue(question.id,"maxLabel",value);
  },container);

  
}

function renderQuestionConfiguration(question,container){
  container.innerHTML="";
  if(question.type==="rating"){
    renderRatingConfiguration(question,container);
  }
  else if(question.type==="linear-scale"){
    renderLinearScaleConfiguration(question,container);
  }
}

function moveQuestion(draggedId,targetId,event){
  updateState(
    function (state){
      const questions=state.questions;
      const draggedIndex=questions.findIndex(
        function (question){
          return(question.id===draggedId
          );
        }
      );
      const targetIndex=questions.findIndex(
        function (question){
          return(question.id===targetId);
        }
      );
      if(draggedIndex===-1 || targetIndex===-1){return;}
      const draggedQuestion=questions[draggedIndex];
      questions.splice(draggedIndex,1);
      let newIndex=targetIndex;
      if(draggedIndex<target){newIndex--;}
      const targetCard=document.querySelector(
      `.builder-question[data-question-id="${targetId}"]`
      );
      if(!targetCard){return;}
      const rect=targetCard.getBoundingClientRect();
      const middle=rect.top+rect.height/2;
      if(event.clientY>middle){newIndex++;}
      questions.splice(newIndex,0,draggedQuestion);
    }
  );
}

function renderAllBuilderQuestions(){
  builderQuestions.innerHTML="";
  const currentSection=appState.sections[appState.respondent.currentSection];
  if(!currentSection){
    return;
  }
  currentSection.questions.forEach(function (question){
    const element=renderBuilderQuestion(question);
    if(element){
        builderQuestions.appendChild(element);
    }
  });
}

const formTitle=document.getElementById("formTitle");
formTitle.addEventListener("input",function(){
  appState.form.title=formTitle.value;
});
const formDescription=document.getElementById("formDescription");
formDescription.addEventListener("input",function (){
  appState.form.description=formDescription.value;
});

const builderModeBtn=document.getElementById("builderModeBtn");
const previewModeBtn=document.getElementById("previewModeBtn");

function setMode(mode){
  if(mode!=="builder" && mode!=="preview"){
    return;
  }
  appState.mode=mode;
  renderApp();
}
  builderModeBtn.addEventListener("click",function (){
    setMode("builder");
  });
  previewModeBtn.addEventListener("click",function (){
    setMode("preview");
  });


function renderLinearScaleQuestion(question,wrapper){
  const scaleContainer=document.createElement("div");
  scaleContainer.classList.add("linear-scale-container");
  const min=question.min ?? 1;
  const max=question.max ?? 5;
  const minLabel=document.createElement("span");
  minLabel.classList.add("scale-label");
  minLabel.textContent=question.minLabel || min;
  scaleContainer.appendChild(minLabel);
  const values=document.createElement("div");
  values.classList.add("linear-scale-values");
  for(let value=min;value<=max;value++){
    const label=document.createElement("label");
    const input=document.createElement("input");
    input.type="radio";
    input.name=`question-${question.id}`;
    input.value=value;
    const number=document.createElement("span");
    number.textContent=value;
    label.appendChild(input);
    label.appendChild(number);
    values.appendChild(label);
    input.addEventListener("change",function(){
      if(!appState.responses){
        appState.responses={};
      }
      appState.responses[question.id]=Number(input.value);
      scaleContainer.querySelectorAll("label").forEach(function (label){
        label.classList.remove("selected");
      });
      input.closest("label").classList.add("selected");
    });
  }
  scaleContainer.appendChild(values);
  const maxLabel=document.createElement("span");
  maxLabel.classList.add("scale-label");
  maxLabel.textContent=question.maxLabel || max;
  scaleContainer.appendChild(maxLabel);
  wrapper.appendChild(scaleContainer);
}

updateHistoryButtons();

function restoreFormDocument(formDocument){
  const normalized=normalizeFormDocument(formDocument);
  pushHistory();
  appState.form=normalized.form;
  appState.sections=normalized.sections;
  appState.responses={};
  applyTheme(appState.form.theme);
  applyFormStyle();
  scheduleSave();
  renderApp();
  renderThemeOptions();
  renderStyleOptions();
  updateHistoryButtons();
}

function normalizeQuestion(
  question
){
  if(!question || typeof question!=="object"){
    return null;
  }
  const normalized={
    id:typeof question.id==="string"?question.id:crypto.randomUUID(),
    type:typeof question.type==="string"?question.type:"short-answer",
    title:typeof question.title==="string"?question.title:"",
    description:typeof question.description==="string"
    ?question.description:"",
    required:Boolean(question.required),
    ...question
  };
  return normalized;
}

function normalizeFormDocument(formDocument){
  if(!formDocument || typeof formDocument!=="object" || !formDocument.form || typeof formDocument.form!=="object" || !Array.isArray(formDocument.sections)){
    throw new Error("Invalid form document.");
  }
  const normalized=structuredClone(formDocument);
  normalized.form.title= typeof normalized.form.title==="string"?normalized.form.title.trim():"Untitled form";
  normalized.form.description=typeof normalized.form.description===
  "string"?normalized.form.description:"";
  if(!THEMES[normalized.form.theme]){
    normalized.form.theme="classic";
  }
  const defaultStyle={
    layout:"comfortable",
    card:"soft",
    corners:"rounded",
    animation:"subtle",
    numbering:"none",
    background:"solid"
  };
  normalized.form.style={
    ...defaultStyle, ...(normalized.form.style || {})
  };
  normalized.sections=normalized.sections.map(
    function (section){
      return {
        ...section,
        id:typeof section.id==="string"?section.id:crypto.randomUUID(),
        title:typeof section.title==="string"?section.title:"",
        description:typeof section.description==="string"?section.description:"",
        questions:Array.isArray(section.questions)?section.questions.map(
          normalizeQuestion
        ).filter(Boolean):[]
      };
    });
    return normalized;
}

function validateFormDocumen(formDocument){
  if(!formDocument || typeof formDocument!=="object"){
    throw new Error(
      "Invalid document."
    );
  }
  if(typeof formDocument.version!=="number"){
    throw new Error("Missing document version.");
  }
  if(!formDocument.form || typeof formDocument.form!=="object"){
    throw new Error("Missing form data.");
  }
  if(typeof formDocument.form.title!=="string"){
    throw new Error("Invalid form title.");
  }
  if(!Array.isArray(formDocument.questions)){
    throw new Error("Invalid questions.");
  }
  return true;
}

function importForm(file){
  const MAX_FILE_SIZE=2*1024*1024;
  if(file.size>MAX_FILE_SIZE){
    alert("The form file is too large.");
    return;
  }
  if(!file){
    return;
  }

  if(file.type!=="application/json" && !file.name.toLowerCase().endsWith(".json")){
    alert("Please select a valid JSON form file.");
    return;
  }
  const reader=new FileReader();
  reader.onload=function (event){
    try{
      const text=event.target.result;
      const formDocument=JSON.parse(text);
      validateFormDocument(formDocument);
      showSaveStatus("Imported");
    }
    catch(error){
      console.error("Impoet failed:",error);
      alert("This file is not a valid form document.");
    }
  };
  reader.onerror=function (){
    alert("Unable to read ther selected file.");
  };
  reader.readAsText(file);
}

function exportForm(){
  try{
    const formDocument=createFormDocument();
    const json=JSON.stringify(formDocument,null,2);
    const blob=new Blob([json],{
      type:"application/json"
    });
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    const safeTitle=(appState.form.title || "untitled-form").trim().replace(
      /[^a-z0-9]+/gi,"-"
    ).replace(/^-+|-+$/g,"").toLowerCase();
    link.href=url;
    link.download=`${safeTitle || "untitled-form"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showSaveStatus("Exported");
}
  catch(error){
    console.error("Export failed:",error);
    showSaveStatus("Export failed");
  }
}

document.getElementById("exportFormBtn").addEventListener(
  "click",exportForm
);

const importFormBtn=document.getElementById("importFormBtn");
const importFormInput=document.getElementById("importFormInput");
importFormBtn.addEventListener("click",function (){
  importFormInput.click();
});
importFormInput.addEventListener("change",function (){
  const file=importFormInput.files[0];
  importForm(file);
  importFormInput.value="";
});

function createNewForm(){
  const confirmed=confirm("Create a new form? Unsaved changes will be replaced.");
  if(!confirmed){
    return;
  }
  appState.form={
    id:crypto.randomUUID(),
    createdAt:new Date().toISOString(),
    title:"Untitled form",
    description:"",
    theme:"classic",
    style:{
      layout:"comfortable",
      card:"soft",
      corners:"rounded",
      animation:"subtle",
      numbering:"none",
      background:"solid"
    }
  };
  appState.sections=[
    {
      id:crypto.randomUUID(),
      title:"Section 1",
      description:"",
      questions:[]
    }
  ];
  appState.responses={};
  history.past=[];
  history.future=[];
  applyTheme("classic");
  applyFormStyle();
  scheduleSave();
  renderApp();
  renderThemeOptions();
  renderStyleOptions();
  updateHistoryButtons();
}

document.getElementById("newFormBtn").addEventListener(
  "click",createNewForm);

  function createShortAnswer(question){
    const input=document.createElement("input");
    input.type="text";
    input.className="respondent-input";
    input.placeholder="Your answer";
    input.value=appState.responses[question.id] || "";
    input.addEventListener("input",function (){
      appState.responses[question.id]=input.value;
      updateRespondentProgress();
    });
    return input;
  }

  function createParagraphtAnswer(question){
    const textarea=document.createElement("textarea");
    textarea.className="respondent-textarea";
    textarea.placeholder="Write your answer...";
    textarea.rows=5;
    textarea.value=appState.responses[question.id] || "";
    input.addEventListener("input",function (){
      appState.responses[question.id]=textarea.value;
      updateRespondentProgress();
    });
    return textarea;
  }

  function createMultipleChoice(question){
    const container=document.createElement("div");
    container.className="choice-list";
    const current=appState.responses[question.id];
    question.options.forEach(function (option,index){
      const label=document.createElement("label");
      label.className="choice-option";
      const input=document.createElement("input");
      input.type="radio";
      input.name=`question-${question.id}`;
      input.value=option;
      input.checked=current===option;
    input.addEventListener("change",function (){
      if(input.checked){
        appState.responses[question.id]=option;
      }
      updateRespondentProgress();
    });
    const text=document.createElement("span");
    text.textContent=option;
    label.appendChild(input);
    label.append(text);
    container.appendChild(label);
  });
    return container;
  }

  function createRespondentRating(question){
    const container=document.createElement("div");
    container.className="respondent-rating";
    const scale=question.scale ||5;
    const icon=RATING_ICONS[question.icon || "star"] || RATING_ICONS.star;
    for(let i=1;i<=scale;i++){
      const button=document.createElement("button");
      button.className="respondent-rating-btn";
      if(icon.values){
        button.textContent=icon.values[Math.min(
          i-1,icon.values.length-1
        )];
      }else{
        button.textContent=icon.empty;
      }
    button.addEventListener("click",function (){
        appState.responses[question.id]=i;
        container.querySelectorAll(
          ".respondent-rating-btn").forEach(function (item,itemIndex){
            const selected=itemIndex+1<=i;
            item.classList.toggle("selected",selected);
            if(!icon.values){
              item.textContent=selected?icon.filled:icon.empty;}});
      updateRespondentProgress();});
    container.appendChild(button);
  }return container;
  }

  function updateRespondentProgress(){
    const questions=getAllQuestions();
    const total=questions.length;
    const answered=questions.filter(function (question){
      const value=appState.responses[question.id];
      if(value===undefined && value==null){
        return false;
      };
      if(typeof value==="String"){
        return value.trim()!=="";
      }
      if(Array.isArray(value)){
        return value.length>0;
      }
      return true;
    }).length;
    const percentage=total===0?0:(answered/total)*100;
    const bar=document.getElementById("respondentProgressBar");
    if(bar){
      bar.style.width=`${percentage}%`;
    }
    const step=document.getElementById("respondentStep");
    if(step){
      step.textContent=`${answered}/${total}`;
    }
  }

  function createAnswerControl(question){
    switch (question.type){
      case "short-answer":return createShortAnswer(question);
      case "paragraph":return createParagraphAnswer(question);
      case "multiple-choice":return createMultipleChoice(question);
      case "checkboxes":return createCheckboxes(question);
      case "dropdown":return createDropdownAnswer(question);
      case "rating":return createRespondentRating(question);
      case "linear-scale":return createRespondentScale(question);
        default:return createUnsupportedAnswer();
    }
  }

  function createRespondentQuestion(question,index){
    const card=document.createElement("article");
    card.className="respondent-question";
    const title=document.createElement("h2");
    title.className="respondent-question-title";
    const numbering=appState.form.style.numbering;
    if(numbering==="numbers"){
      title.textContent=`${index+1}.${question.title}`;
    }else{title.textContent=question.title || "Untitled question";}
    if(question.required){
      const required=document.createElement("span");
      required.className="required-marker";
      required.textContent="*";
      title.appendChild(required);
    }
    card.appendChild(title);
    if(question.description){
      const description=document.createElement("p");
      description.className="respondent-question-description";
      description.textContent=question.description;
      card.appendChild(description);
    }
    const answerArea=createAnswerControl(question);
    card.appendChild(answerArea);
    const error=document.createElement("div");
error.className="respondent-question-error";
error.hidden=true;
card.appendChild(error);
    return card;
  }

function showQuestionError(message){
    const error=document.querySelector(".respondent-question-error");
    if(!error){
        return;
    }
    error.textContent=message;
    error.hidden=false;
}

function clearQuestionError(){
    const error=document.querySelector(".respondent-question-error");
    if(!error){
        return;
    }
    error.hidden=true;
}

function getNextQuestion(question,currentIndex){
  const questions=getAllQuestions();
  if(!question || !Array.isArray(questions)){
    return null;
  }
    if(question.logic && question.logic.enabled){
        const nextByLogic=evaluateQuestionLogic(question);
        if(nextByLogic!==null){
            return nextByLogic;
        }
    }
    const nextIndex=currentIndex+1;
    if(nextIndex>=questions.length){
        return null;
    }
    return nextIndex;
}

function evaluateQuestionLogic(question){
    const logic=question.logic;
    if(
        !logic || !logic.enabled || !Array.isArray(logic.rules)){
        return null;
    }
    const answer=appState.responses[question.id];
        for(const rule of logic.rules){
        if(rule.if && answer===rule.if.value){
            const questions=getAllQuestions();
            const targetIndex=questions.findIndex(
                    function (item){return (item.id===rule.goTo);});
            if(targetIndex!==-1){
                return targetIndex;
            }
        }
    }
    return null;
}

function renderCompletionScreen(){
    const container=document.getElementById("respondentQuestions");
    if(!container){
        return;
    }
    container.innerHTML=`<div class="completion-screen">
            <div class="completion-icon">
                <i class="fa-solid fa-circle-check"></i>
            </div>
            <h2>Thank you!</h2>
            <p>Your response has been recorded.</p>
            <button type="button"
                id="restartFormBtn"
                class="respondent-nav-btn primary">
                <i class="fa-solid fa-rotate-right"></i>Start again</button>
        </div>`;
    document.getElementById("restartFormBtn")?.addEventListener("click",
            restartRespondentForm
        );
    const backBtn=document.getElementById("respondentBackBtn");
    if(backBtn){
        backBtn.hidden=true;
    }
    const nextBtn=document.getElementById("respondentNextBtn");
    if(nextBtn){
        nextBtn.hidden=true;
    }
    const step=document.getElementById("respondentStep");
    if(step){
        step.textContent="Complete";
    }
    const progress=document.getElementById("respondentProgressBar");
    if(progress){
        progress.style.width="100%";
    }
}

function submitRespondentForm(){
    console.log("Form submitted:",appState.responses);
    appState.respondent.completed=true;
    renderRespondentMode();
}

function restartRespondentForm() {
    appState.responses={};
    appState.respondent.currentQuestion=0;
    appState.respondent.completed=false;
    const backBtn=document.getElementById("respondentBackBtn");
    const nextBtn=document.getElementById("respondentNextBtn");
    if(backBtn){
        backBtn.hidden=false;
    }
    if(nextBtn){
        nextBtn.hidden=false;
    }
    renderRespondentMode();
}

function updateRespondentNavigation() {
    const backBtn=document.getElementById("respondentBackBtn");
    const nextBtn=document.getElementById("respondentNextBtn");
    const step=document.getElementById("respondentStep");
    const questions=getAllQuestions();
    const current=appState.respondent.currentQuestion;
    const total=questions.length;
    if(step){step.textContent=`${current+1}/${total}`;}
    if(backBtn){backBtn.disabled=current===0;}
    if(nextBtn){
        const lastQuestion=current===total-1;
        nextBtn.innerHTML=lastQuestion? `Submit
                    <i class="fa-solid fa-check"></i>`: `Continue
                    <i class="fa-solid fa-arrow-right"></i>`;
    }
}

function hasAnswer(question){
    const answer=appState.responses[question.id];
    if(answer===undefined || answer===null){
        return false;
    }
    if(typeof answer==="string"){
        return answer.trim().length>0;
    }
    if(Array.isArray(answer)){
        return answer.length>0;
    }
    return true;

}

function handleRespondentNext(){
    const index=appState.respondent.currentQuestion;
    const questions=getAllQuestions();
    const question=questions[index];
    if(!question){return;}
    if (question.required && !hasAnswer(question)){
        showQuestionError("Please answer this question before continuing.");
        return;
    }
    clearQuestionError();
    const nextQuestion=getNextQuestion(question,index);
    if(nextQuestion===null){submitRespondentForm();
        return;
    }
    appState.respondent.currentQuestion=nextQuestion;
    renderRespondentMode();
}

document.getElementById("respondentBackBtn").addEventListener(
        "click",function(){
            if(appState.respondent.currentQuestion<=0){
                return;
            }
            appState.respondent.currentQuestion--;
            renderRespondentMode();
        }
    );

    document.getElementById("respondentNextBtn").addEventListener(
        "click", handleRespondentNext
    );

function renderRespondentMode(){
    const title=document.getElementById("respondentTitle");
    const description=document.getElementById("respondentDescription");
    const container=document.getElementById("respondentQuestions");
    if(!title || !container){return;}
    title.textContent=appState.form.title ||"Untitled form";
    description.textContent=appState.form.description ||"";
    if(appState.respondent.completed){
        renderCompletionScreen();
        return;
    }
    const index=appState.respondent.currentQuestion;
    const questions=getAllQuestions();
    const question=questions[index];
    if(!question){renderCompletionScreen();
        return;
    }
    container.innerHTML="";
    const card=createRespondentQuestion(question,index);
    container.appendChild(card);
    updateRespondentNavigation();
    updateRespondentProgress();
}


function updateCurrentQuestion(changes){
    const question=findQuestion(inspectorState.questionId,inspectorState.sectionId);
    if(!question){
        return;
    }
    Object.assign(question,changes);
    scheduleSave();
    renderApp();
}

function changeQuestionType(newType){
    const question=findQuestion(inspectorState.questionId,inspectorState.sectionId);
    if(!question){
        return;
    }
    pushHistory();
    question.type=newType;
    if(["multiple-choice","checkboxes","dropdown"].includes(newType) &&
        !question.options){
        question.options=["Option 1","Option 2","Option 3"];
    }
    if(newType==="rating"){
        question.scale ??=5;
        question.icon ??="star";
    }
    if(newType==="linear-scale"){
        question.min ??=1;
        question.max ??=5;
    }
    scheduleSave();
    renderQuestionInspector(question);
    renderApp();
}

function attachOptionListeners(){
    document.querySelectorAll("[data-option-index]").forEach(
            function (input){
                if(input.tagName!=="INPUT"){
                    return;
                }
                input.addEventListener("input",
                    function (){
                        const question=findQuestion(inspectorState.questionId,inspectorState.sectionId);
                        const index=Number(input.dataset.optionIndex);
                        if(question?.options?.[index]!==undefined){
                            question.options[index]=input.value;
                            scheduleSave();
                        }
                    });
            });
    document.querySelectorAll(".remove-option").forEach(
            function (button){button.addEventListener("click",
                    function (){
                        const question=findQuestion(inspectorState.questionId,
                                inspectorState.sectionId
                            );
                        const index=Number(button.dataset.optionIndex);
                        if(!question || !question.options) {
                            return;
                        }
                        if(question.options.length<= 1){
                            return;
                        }
                        pushHistory();
                        question.options.splice(index,1);
                        renderQuestionInspector(question);
                        renderApp();
                    });
            });
    document.getElementById("addInspectorOption")?.addEventListener("click",
            function (){
                const question=findQuestion(inspectorState.questionId,
                        inspectorState.sectionId);
                if(!question){return;}
                pushHistory();
                question.options ??=[];
                question.options.push(`Option ${
                        question.options.length+1}`);
                renderQuestionInspector(question);
                renderApp();
            });
}

function attachRatingListeners(){
    const scale=document.getElementById("ratingScale");
    const icon=document.getElementById("ratingIcon");
    scale?.addEventListener("change",
        function (){updateCurrentQuestion({
                    scale:Number(scale.value)
                });
        });
    icon?.addEventListener("change",
        function (){updateCurrentQuestion({
                    icon:icon.value
                });
        });
}

function attachScaleListeners(){
    const min=document.getElementById("scaleMin");
    const max=document.getElementById("scaleMax");
    min?.addEventListener("change",
        function (){updateCurrentQuestion({
                    min:Number(min.value)
                });
        });
    max?.addEventListener("change",
        function (){updateCurrentQuestion({
                    max:Number(max.value)
                });
        });
}

document.getElementById("inspectorDeleteQuestion").addEventListener("click",
        function (){
            const questionId=inspectorState.questionId;
            const sectionId=inspectorState.sectionId;
            if(!questionId || !sectionId){
                return;
            }
            const section=appState.sections.find(section=>section.id===sectionId);
            if(!section){
                return;
            }
            const index=section.questions.findIndex(question=>question.id===questionId);
            if(index===-1){
                return;
            }
            pushHistory();
            section.questions.splice(index,1);
            closeQuestionInspector();
            scheduleSave();
            renderApp();
            updateHistoryButtons();
        });

    let logicDraft=[];

    function openLogicBuilder(){
    const question=findQuestion(inspectorState.questionId,
      inspectorState.sectionId);
    if(!question){
      console.log("Logic builder: question not found",{
        questionId:inspectorState.questionId,
        sectionId:inspectorState.sectionId
      });
        return;
    }
    console.log("Logic builder:question found.",question);
    question.logic ??= [];
    logicDraft=structuredClone(question.logic);
    renderLogicBuilder(question);
    const overlay=document.getElementById("logicBuilderOverlay");
    overlay.hidden=false;
}

document.getElementById("openLogicBuilder").addEventListener(
  "click",openLogicBuilder
);

function closeLogicBuilder(){
    document.getElementById("logicBuilderOverlay").hidden=true;
}

document.getElementById("closeLogicBuilder").addEventListener(
        "click",closeLogicBuilder
    );

document.getElementById("cancelLogic").addEventListener(
        "click",closeLogicBuilder
    );

function createLogicRule(question){
    return {
        id:crypto.randomUUID(),
        condition:"equals",
        value:question.options?.[0] || "",
        action:"go-to-section",
        target:appState.sections[0]?.id || ""
    };
}

function renderLogicBuilder(question){
    const body=document.getElementById("logicBuilderBody");
    if(!logicDraft.length){
        body.innerHTML=`<div class="logic-empty">
                <div class="logic-empty-icon">
                    <i class="fa-solid fa-code-branch"></i>
                </div>
                <h3>No rules yet</h3>
                <p>Create a rule to control the respondent's journey.</p>
                <button type="button"
                    id="addFirstLogicRule"
                    class="primary-button">
                    <i class="fa-solid fa-plus"></i>Add rule</button>
            </div>`;
        document.getElementById("addFirstLogicRule").addEventListener("click",
                function (){
                    logicDraft.push(createLogicRule(question));
                    renderLogicBuilder(question);
                });
        return;
    }

    body.innerHTML=`<div class="logic-rules">
            ${logicDraft.map((rule,index)=>
                    renderLogicRule(question,rule,index)).join("")}
        </div>
        <button type="button"
            id="addLogicRule"
            class="add-rule-button">
            <i class="fa-solid fa-plus"></i> Add another rule</button>`;
    attachLogicListeners(question);
}

function renderLogicRule(question,rule,index){
  const supportsLogic=["multiple-choice","checkboxes","dropdown"].includes(question.type);
    const options=question.options || [];
    const sections=appState.sections.filter(
        section=>section.id!==question.sectionId);
    return `
        <div class="logic-rule" data-rule-index="${index}">
            <div class="logic-rule-header">
                <strong>Rule ${index+1}</strong>
                <button type="button"
                    class="remove-logic-rule"
                    data-rule-index="${index}">
                    <i class="fa-solid fa-trash"></i></button></div>
            <div class="logic-row">
                <span>When the answer</span>
                <select class="logic-condition" data-rule-index="${index}">
                    <option value="equals"
                        ${rule.condition==="equals"? "selected":""}>
                        is
                    </option>
                    <option value="not-equals"
                        ${rule.condition==="not-equals"?"selected":""}>
                        is not
                    </option></select>
                <select class="logic-value" data-rule-index="${index}">
                    ${options.map(option=>`
                            <option value="${escapeAttribute(option)}"
                                ${option===rule.value?"selected":""}>
                                ${escapeHTML(option)}
                            </option>`).join("")}</select>
            </div>
            <div class="logic-arrow">
                <i class="fa-solid fa-arrow-down"></i></div>
            <div class="logic-row">
                <span>Then</span>
                <select class="logic-action" data-rule-index="${index}">
                    <option value="go-to-section">Go to section</option>
                    <option value="submit">Submit form</option></select>
            </div>
            <div class="logic-target-container" data-target-for="${index}">
                ${renderLogicTarget(rule,sections)}
            </div></div>`;
}

function renderLogicTarget(rule,sections){
    if(rule.action==="submit"){
        return `<div class="logic-submit-preview">
                <i class="fa-solid fa-paper-plane"></i>
                Submit the form
            </div>`;
    }
    return `<select class="logic-target">
            ${sections.map(section=> `
                    <option value="${section.id}"
                        ${section.id===rule.target?"selected":""}>
                        ${escapeHTML(section.title || "Untitled section")}
                    </option>`).join("")} </select>`;
}

function attachLogicListeners(question){
    document.getElementById("addLogicRule")?.addEventListener("click",
            function (){
                logicDraft.push(createLogicRule(question));
                renderLogicBuilder(question);
            });

    document.querySelectorAll(".remove-logic-rule").forEach(
            button=>{button.addEventListener("click",
                    function (){
                        const index=Number(button.dataset.ruleIndex);
                        logicDraft.splice(index,1);
                        renderLogicBuilder(question);
                    });
            });
    document.querySelectorAll(".logic-condition").forEach(select=>{
                select.addEventListener("change",
                    function (){
                        const index=Number(select.dataset.ruleIndex);
                        logicDraft[index].condition=select.value;
                    });
            });
    document.querySelectorAll(".logic-value").forEach(select=>{
                select.addEventListener("change",
                    function (){
                        const index=Number(select.dataset.ruleIndex);
                        logicDraft[index].value=select.value;
                    });
            });
    document.querySelectorAll(".logic-action").forEach(select=>{
                select.addEventListener("change",
                    function (){
                        const index=Number(select.dataset.ruleIndex);
                        logicDraft[index].action=select.value;
                        renderLogicBuilder(question);
                    });
            });

    document.querySelectorAll(".logic-target").forEach(select=>{
        select.addEventListener("change",
            function (){
                const ruleIndex=Number(select.closest(".logic-rule").dataset.ruleIndex);
                logicDraft[ruleIndex].target=select.value;
                    });
            });
}

updateFlowHealthBadge();

document.getElementById("saveLogic").addEventListener("click",
    function (){
        const question=findQuestion(inspectorState.questionId,inspectorStat.sectionId);
        if(!question){return;}
            pushHistory();
            question.logic=structuredClone(logicDraft);
            scheduleSave();
            closeLogicBuilder();
            renderQuestionInspector(question);
            renderApp();
            updateHistoryButtons();
        });

  const flowMapState={
    zoom: 1,
    x: 0,
    y: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
};

function openFlowMap(){
    const overlay=document.getElementById("flowMapOverlay");
    if(!overlay){
      return;
    }
    overlay.hidden=false;
    renderFlowMap();
    resetFlowMapView();
}
document.getElementById("flowMapBtn")?.addEventListener(
  "click",openFlowMap
);
document.getElementById("openFlowMap")?.addEventListener(
  "click",openFlowMap
);

function closeFlowMap(){
    document.getElementById("flowMapOverlay").hidden=true;
}

document.getElementById("closeFlowMap").addEventListener(
        "click",closeFlowMap
    );

 function getQuestionTypeLabel(type){
    const item=QUESTION_TYPES.find(
        questionType =>questionType.type===type );
    return (item?.label || "Question");
}  

const flowLayout={};

function getFlowPosition(nodeId, defaultX, defaultY){
    if(flowLayout[nodeId]){
        return flowLayout[nodeId];
    }
    flowLayout[nodeId]={x:defaultX, y:defaultY};
    return flowLayout[nodeId];
}

function createFlowNodes(){
   const nodes=[];
   const canvas=document.getElementById("flowMapCanvas");
   const nodeWidth=230;
   const defaultX=Math.max(30,(
    (canvas?.clientWidth || 900)-nodeWidth)/2
  );
   const startPosition=getFlowPosition("flow-start",defaultX,40);
    nodes.push({
        id:"flow-start",
        type:"start",
        title:"Start",
        description:"Form begins here.",
        x:startPosition.x,y:startPosition.y
    });
    let y=180;
    (appState.sections || []).forEach(
    function (section){
        const sectionNodeId=`section-${section.id}`;
        const sectionPosition=getFlowPosition(sectionNodeId,defaultX,y);
    nodes.push({
     id:sectionNodeId, type:"section",
     sectionId:section.id,
    title:section.title || "Untitled section",
    description:section.description || "Form section",
    x:sectionPosition.x,y:sectionPosition.y
  });
    y+=140;
   (section.questions || []).forEach(
    function (question){
      const questionNodeId=`question-${question.id}`;
      const questionPosition=getFlowPosition(questionNodeId,defaultX,y);
    nodes.push({
      id:questionNodeId, type:"question",
      sectionId:section.id, questionId:question.id,
      title:question.title || "Untitled question",
      description:getQuestionTypeLabel(question.type),
      x:questionPosition.x,y:questionPosition.y
    });
    y+=140;
  });
});
  const endPosition=getFlowPosition(
    "flow-end",defaultX,y+40
  );
  nodes.push({
    id:"flow-end",
    type:"end",
    title:"Finish",
    description:"Form submission.",
    x:endPosition.x, y:endPosition.y
  });
  return nodes;
}

function renderFlowMap(){
    const world=document.getElementById("flowMapWorld");
    world.innerHTML=`<svg id="flowConnections"
            class="flow-connections"></svg>`;
    const nodes=createFlowNodes();
      nodes.forEach(function (node){
            const element=document.createElement("div");
            element.className=`flow-node ${node.type}`;
            element.dataset.nodeId=node.id;
            element.style.left=`${node.x}px`;
            element.style.top=`${node.y}px`;
            element.innerHTML=`<div class="flow-node-header">
                    <div class="flow-node-icon">
                        <i class="${getFlowNodeIcon(node.type )}"></i></div>
                    <div class="flow-node-title">
                        ${escapeHTML(node.title )}</div>
                </div>
                <div class="flow-node-description">
                    ${escapeHTML(node.description)}
                </div>`;
  element.addEventListener("click", function (){
    if(element.dataset.dragged==="true"){
      element.dataset.dragged==="false";
      return;
    }
    handleFlowNodeClick(node);});
  element.addEventListener("pointerdown",
    function (event){
        event.stopPropagation();
        flowDragState.active=true;
        flowDragState.node=node;
        flowDragState.startX=event.clientX;
        flowDragState.startY=event.clientY;
        flowDragState.originalX=node.x;
        flowDragState.originalY=node.y;
        element.setPointerCapture(event.pointerId);
        element.classList.add("dragging");});
        element.addEventListener("pointermove",function (event){
        if(!flowDragState.active ||flowDragState.node!==node){
            return;
        }
        const dx=(event.clientX-flowDragState.startX)/flowMapState.zoom;
        const dy=(event.clientY-flowDragState.startY)/flowMapState.zoom;
        if(Math.abs(dx)>4 || Math.abs(dy)>4){
          element.dataset.dragged="true";
        }
        node.x=flowDragState.originalX+dx;
        node.y=flowDragState.originalY+dy;
        element.style.left=`${node.x}px`;
        element.style.top=`${node.y}px`;
        drawFlowConnections(createFlowNodes());
    });
 element.addEventListener("pointerup",
    function (){
      flowLayout[node.id]={
        x:node.x,
        y:node.y
      };
        flowDragState.active=false;
        flowDragState.node=null;
        element.classList.remove("dragging");});
       world.appendChild(element);}
);
    drawFlowConnections(nodes);
}

function getFlowNodeIcon(type){
    const icons={
        start:"fa-solid fa-play",
        section:"fa-solid fa-layer-group",
        question:"fa-solid fa-circle-question",
        end:"fa-solid fa-flag-checkered"
    };
    return (icons[type] || icons.question);
}

function drawFlowConnections(nodes){
    const svg=document.getElementById("flowConnections");
    if(!svg){return; }
    svg.innerHTML="";
    const nodeById=new Map(
      nodes.map(function (node){
        return [node.id,node];
      })
    );
    function connect(fromId,toId){
      const from=nodeById.get(fromId);
      const to=nodeById.get(toId);
      if(from && to){
        drawConnection(svg,from,to);
      }
    }
    const sections=appState.sections || [];
    if(sections.length===0){
      connect("flow-start","flow-end");
    }
    else{
      connect("flow-start",`section-${sections[0].id}`);
      sections.forEach(function (section,index){
        const questions=section.questions || [];
        const nextSection=sections[index+1];
        if(questions.length>0){
          connect(`section-${section.id}`,`question-${questions[0].id}`);
          for(let i=0;i<questions.length-1;i++){
            connect(`question-${questions[i].id}`,
              `question-${questions[i+1].id}`
            );
          }
          const lastQuestion=questions[questions.length-1];
          connect(`question-${lastQuestion.id}`,
            nextSection?`section-${nextSection.id}`:"flow-end"
          );
        }
        else{connect(
          `section-${section.id}`,nextSection?
          `section-${nextSection.id}`:"flow-end"
        );
      }
      });
    }
    drawLogicConnections(svg,nodes);
}

function drawConnection(svg,from,to){
    const x1=from.x+115;
     const y1=from.y+90;
    const x2=to.x+115;
    const y2=to.y;
    const curve=Math.max(40,Math.abs(y2-y1)*0.45 );
    const path=document.createElementNS("http://www.w3.org/2000/svg","path");
    const pathData=`M ${x1} ${y1} C ${x1} ${y1+curve},
     ${x2} ${y2-curve}, ${x2} ${y2}`;
    path.setAttribute("d",pathData.trim());
    path.classList.add("flow-connection");
    svg.appendChild(path);
}

function drawLogicConnections(svg,nodes){
    appState.sections.forEach(function (section){
    section.questions.forEach(
        function (question){
            if(!question.logic?.length){
                return;
            }
            const source=nodes.find(node=>node.questionId===question.id);
            if(!source){
                return;
            }
            question.logic.forEach(
                function (rule){
                    if( rule.action!=="go-to-section"){
                        return;
                    }
                    const target=nodes.find(node=>node.sectionId===rule.target);
                    if(!target){return; }
                    drawLogicConnection(svg,source,target,rule);
                });
        });
});
}

updateFlowHealthBadge();

function drawLogicConnection(svg,from,to,rule){
    const x1=from.x+230;
    const y1=from.y+45;
    const x2=to.x+230;
    const y2=to.y+45;
    const middleX=(x1+x2)/2;
    const path=document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d",`M ${x1} ${y1} C ${middleX} ${y1},
            ${middleX} ${y2},${x2} ${y2}`);
    path.classList.add("flow-logic-connection");
    svg.appendChild(path);
    const text=document.createElementNS("http://www.w3.org/2000/svg","text");
    text.setAttribute("x",middleX);
    text.setAttribute("y",(y1+y2)/2-5);
    text.setAttribute("text-anchor","middle");
    text.textContent=rule?.value??rule?.condition??"Logic";
    svg.appendChild(text);
}

function scrollToSection(sectionId){
  const sectionElement=Array.from(document.querySelectorAll(
    ".builder-section")
  ).find(function (element){
    return element.dataset.sectionId===String(sectionId);
  });
  if(!sectionElement){
    console.warn("Could not find section in builder:",sectionId);
    return;
  }
  sectionElement.scrollIntoView({
    behavior:"smooth",
    block:"center"
  });
}

function handleFlowNodeClick(node){
  if(node.type==="start"){
    alert("START OF FORM\n\n Respondents begin filling out your form from here.");
    return;
  }
  if(node.type==="end"){
    alert("END OF FORM\n\n Respondents reach this point when they finish and submit the form.");
    return;
  }
    if(node.type==="section"){
      closeFlowMap();
      scrollToSection(node.sectionId);
      return;
}
    if(node.type==="question"){
        closeFlowMap();
        openQuestionInspector(node.questionId,node.sectionId);}
}

function updateFlowMapTransform(){
    const world=document.getElementById("flowMapWorld");
    if(!world){return;}
    world.style.transform=`translate(
                ${flowMapState.x}px,${flowMapState.y}px)
            scale(${flowMapState.zoom}) `;
    document.getElementById("flowZoomValue").textContent=`${Math.round(
            flowMapState.zoom*100)}%`;
}

function changeFlowZoom(amount){
    flowMapState.zoom=Math.min(2,Math.max(0.4,flowMapState.zoom+amount));
    updateFlowMapTransform();
}

document.getElementById("flowZoomIn").addEventListener(
        "click",()=>changeFlowZoom(0.1));
document.getElementById("flowZoomOut").addEventListener(
        "click",()=>changeFlowZoom(-.1));

function resetFlowMapView(){
    flowMapState.zoom=1;
    flowMapState.x=0;
    flowMapState.y=0;
    updateFlowMapTransform();
}

document.getElementById("resetFlowMap").addEventListener(
  "click",resetFlowMapView);
  const flowCanvas=document.getElementById( "flowMapCanvas" );
  flowCanvas.addEventListener("pointerdown",function (event){
        if (event.target.closest(".flow-node")){ return;}
        flowMapState.dragging=true;
        flowMapState.startX=event.clientX;
        flowMapState.startY=event.clientY;
        flowMapState.originX=flowMapState.x;
        flowMapState.originY=flowMapState.y;
        flowCanvas.classList.add("dragging");
        flowCanvas.setPointerCapture(event.pointerId);
    }
);

flowCanvas.addEventListener("pointermove",
    function (event){
        if(!flowMapState.dragging){return;}
        flowMapState.x=flowMapState.originX+(event.clientX-flowMapState.startX);
        flowMapState.y=flowMapState.originY+(event.clientY-flowMapState.startY);
        updateFlowMapTransform();
    }
);

flowCanvas.addEventListener("pointerup",
    function (){flowMapState.dragging=false;
        flowCanvas.classList.remove("dragging");
    }
);

const flowDragState={
    active: false,
    node: null,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0
};

if(flowCanvas && !flowCanvas.dataset.connectionEventsBound){
  flowCanvas.dataset.connectionEventsBound="true";
  const connectionState={
    active: false,
    sourceId: null
};
flowCanvas.addEventListener("click",function (event){
  const outputHandle=event.target.closest(".output-handle");
  const inputHandle=event.target.closest(".input-handle");
  if(outputHandle){
    event.stopPropagation();
    connectionState.active=true;
    connectionState.sourceId=outputHandle.dataset.nodeId;
    flowCanvas.classList.add("connecting");
    return;
  }
  if(inputHandle){
    event.stopPropagation();
    if(!connectionState.active || !connectionState.sourceId){
      return;
    }
    const sourceId=connectionState.sourceId;
    const targetId=inputHandle.dataset.nodeId;
    if(!targetId || sourceId===targetId){
      cancelConnection();
      return;
    }
    if(!Array.isArray(flowGraph.connections)){
      flowGraph.connections=[];
    }
    const alreadyExists=flowGraph.connections.some(
      connection=>connection.source===sourceId && 
      connection.target===targetId
    );
    if(!alreadyExists){
      flowGraph.connections.push({
        id:`${sourceId}-${targetId}`,
        source:sourceId, target:targetId
      });
    }
    cancelConnection();
    renderFlowMap();
  }
});
}

function cancelConnection(){
    connectionState.active=false;
    connectionState.sourceId=null;
    document.getElementById("flowMapCanvas").classList.remove("connecting");
}

const flowGraph={
  connections:[]
};


function buildSectionGraph(sections){
    const graph=new Map();
    sections.forEach(section=>{
            graph.set(section.id,[]);
        });
    sections.forEach(section=>{
        section.questions?.forEach(question=>{
            question.logic?.forEach(rule=>{
            if(rule.action!=="go-to-section"){
                return;
            }
            if(graph.has(section.id) && graph.has(rule.target)){
                graph.get(section.id).push(rule.target);
            }
        });
    });
});
    return graph;
}

function detectCycles(graph){
    const visited=new Set();
    const active=new Set();
    const cycles=[];
    function visit(node){
        if(active.has(node)){
            cycles.push(node);
            return true;
        }
        if(visited.has(node)){
            return false;
        }
        visited.add(node);
        active.add(node);
        const neighbours=graph.get(node) || [];
        for(const neighbour of neighbours){
            if(visit(neighbour)){
                return true;
            }
        }
        active.delete(node);
        return false;
    }
    graph.forEach((_,node)=>{
            visit(node);
        });
    return cycles;
}

function renderFlowHealth(){
    const issues=analyzeFlow();
    const summary=document.getElementById("flowHealthSummary");
    const container=document.getElementById("flowHealthIssues");
    const errors=issues.filter(issue=>issue.severity==="error").length;
    const warnings=issues.filter(issue=>issue.severity==="warning").length;
    summary.innerHTML=`<div class="health-stat">
            <div class="health-stat-value">${errors}</div>
            <div class="health-stat-label">Errors</div></div>
        <div class="health-stat">
            <div class="health-stat-value">${warnings}</div>
            <div class="health-stat-label">Warnings</div></div>
        <div class="health-stat">
            <div class="health-stat-value">
                ${errors===0 && warnings===0? "✓":"!"}</div>
            <div class="health-stat-label">Status</div>
        </div>`;
    if(!issues.length){
        container.innerHTML=`<div class="flow-issue success">
                <div class="flow-issue-icon">
                    <i class="fa-solid fa-check"></i></div>
                <div class="flow-issue-content">
                    <div class="flow-issue-title">Everything looks healthy</div>
                    <div class="flow-issue-description">
                        We couldn't find any structural problems in your current form flow.
                    </div></div>
            </div>`;
        return;
    }


    container.innerHTML=issues.map(renderFlowIssue).join("");
    attachFlowIssueListeners();
}

function renderFlowIssue(issue){
    const icon=issue.severity==="error"?"fa-circle-xmark":"fa-triangle-exclamation";
    return `<article class="flow-issue ${issue.severity}"
            data-issue-id="${issue.id}">
            <div class="flow-issue-icon">
                <i class="fa-solid ${icon}"></i></div>
            <div class="flow-issue-content">
                <div class="flow-issue-title">${escapeHTML(issue.title)}</div>
                <div class="flow-issue-description">
                    ${escapeHTML(issue.description)}</div>
                ${issue.sectionId || issue.questionId? `
                <button type="button"
                    class="flow-issue-fix"
                    data-section-id="${issue.sectionId || ""}"
                    data-question-id="${issue.questionId || ""}">
                    Inspect
                    <i class="fa-solid fa-arrow-right"></i>
                   </button>`:""}</div></article>`;
}

function attachFlowIssueListeners(){
    document.querySelectorAll(".flow-issue-fix").forEach(
        button=>{button.addEventListener("click",function (){
            const sectionId=button.dataset.sectionId;
            const questionId=button.dataset.questionId;
            document.getElementById("flowHealthOverlay").hidden=true;
            if(questionId){openQuestionInspector(questionId,sectionId);
                return;
            }
            if(sectionId){scrollToSection(sectionId);
                }
            });
    });
}

document.getElementById("openFlowHealth").addEventListener("click",
    function (){renderFlowHealth();
        document.getElementById("flowHealthOverlay").hidden=false;
        });
document.getElementById("closeFlowHealth").addEventListener("click",
        function (){
            document.getElementById("flowHealthOverlay").hidden = true;
        });

const FORM_SCHEMA_VERSION=2;

function createFormSchema(){
    return {
        id:crypto.randomUUID(),
        version:FORM_SCHEMA_VERSION,
        metadata:{
            title:appState.form?.title || "Untitled form",
            description:appState.form?.description || "",
            ownerId:null,
            createdAt:new Date().toISOString(),
            updatedAt:new Date().toISOString()
        },
        settings:{
            collectEmail:false,
            allowMultipleResponses:false,
            showProgress:true,
            shuffleQuestions:false,
            confirmationMessage:"Your response has been submitted."
        },
        sections:[],
        flow: {connections: []},
        editor:{flowLayout: {}}
    };
}

function serializeForm(){
    const schema=createFormSchema();
    schema.id=appState.form?.id || schema.id;
    schema.metadata.title=appState.form?.title || "Untitled form";
    schema.metadata.description=appState.form?.description || "";
    schema.sections=(appState.sections || []).map(serializeSection);
    schema.flow.connections=buildFlowConnections();
    schema.editor.flowLayout=structuredClone(flowLayout);
    schema.metadata.updatedAt=new Date().toISOString();
    return schema;
}

function serializeSection(section){
    return {
        id:section.id,
        title:section.title || "",
        description:section.description || "",
        questions:(section.questions || []).map(serializeQuestion),
        navigation:structuredClone(section.navigation || {})
    };
}

function serializeQuestion(question){
    return {
        id:question.id,
        type:question.type,
        title:question.title || "",
        description:question.description || "",
        required:Boolean(question.required),
        options:Array.isArray(question.options)?[...question.options]:[],
        placeholder:question.placeholder || "",
        validation:structuredClone(question.validation || {}),
        logic:Array.isArray(question.logic)? structuredClone(question.logic):[]
    };

}

function buildFlowConnections(){
    const connections=[];
    const sections=appState.sections || [];
    // Normal section progression
    for(let i = 0;i<sections.length-1;i++){
        connections.push({
            id:`next-${sections[i].id}-${sections[i + 1].id}`,
            source:`section-${sections[i].id}`,
            target:`section-${sections[i + 1].id}`,
            type:"next"
        });
    }
    // Conditional connections
    sections.forEach(
        section=>{
            section.questions?.forEach(
                question=>{question.logic?.forEach(
                        rule=>{
                            if(rule.action!=="go-to-section"){
                                return;
                            }
            connections.push({
                 id:rule.id,
                 source:`question-${question.id}`,
                 target:`section-${rule.target}`,
                 type:"logic",
                condition:{
                    operator:rule.condition,
                    value:rule.value
                    }
            });
        });
        });
    });
    return connections;
}

function validateFormSchema(schema){
    const errors=[];
    if(!schema || typeof schema!=="object" || Array.isArray(schema)){
      return ["Form schema must be a valid object."];
    }
    if(typeof schema.id !=="string" || !schema.id.trim()){
        errors.push("Form ID is missing.");
    }
    if(!schema.metadata || typeof schema.metadata!=="object"){
      errors.push("Form metadata is missing.");
    }
    else if(typeof schema.metadata.title!=="string" ||
       !schema.metadata.title.trim()){
        errors.push("Form title is required.");
    }
    if(!Array.isArray(schema.sections)){
        errors.push("Sections must be an array.");
        return errors;
    }
    schema.sections.forEach((section,sectionIndex)=>{
        if(!section || typeof section!=="object" || 
          Array.isArray(section)){
            errors.push(`Section ${sectionIndex+1} is invalid.`);
            return;
        }
        if(typeof section.id!=="string" ||!section.id.trim()){
          errors.push(`Section ${sectionIndex+1} has no ID.`);
        }
        if(!Array.isArray(section.questions)){
            errors.push(`Section ${sectionIndex+1} has invalid questions.`);
            return;
        }
    section.questions.forEach((question,questionIndex)=>{
      const questionLabel=`Question ${questionIndex+1} 
      in section ${sectionIndex+1}`;
      if(!question || typeof question!=="object" || Array.isArray(question)){
        errors.push(`${questionLabel} is invalid.`);
        return;
      }
        if(typeof question.id!=="string" || !question.id.trim()){
            errors.push(`${questionLabel} has no ID.`);
        }
        if(typeof question.type!=="string" || !question.type.trim()){
            errors.push(`${questionLabel} has no type.`);
        }
        if(typeof question.title!=="string" || !question.title.trim()){
            errors.push(`${questionLabel} has no title.`);
        }
    });
});
    return errors;
}

function prepareFormForSave(){
    const schema=serializeForm();
    const errors=validateFormSchema(schema);
    if(errors.length){
        console.error("Form validation failed:",errors);
        return {
            success:false,errors
        };
    }
    return {
        success:true,
        data:schema
    };
}

document.getElementById("debugFormSchema").addEventListener("click",
    function (){
        const result=prepareFormForSave();
        if(!result.success){
          console.error("Form validation failed:",result.errors);
          alert("The form schema could not be generated. "+"Check the browser console for details.");
          return;
        }
        console.log("FORM SCHEMA",result.data);
    });

function exportFormSchema(){
    const result=prepareFormForSave();
    if(!result.success){
        console.error(result.errors);
        return;
    }
    const json=JSON.stringify(result.data,null,2);
    const blob=new Blob([json],{
                type:"application/json"
            });
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=`${result.data.metadata.title || "form"}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

const runtimeState={
    schema:null,
    currentSectionIndex:0,
    answers:{},
    startedAt:null,
    completedAt:null,
    submitted:false
};

function startForm(schema){
    const errors=validateFormSchema(schema);
    if(errors.length){
        console.error("Cannot start form:",errors);
        return false;
    }
    runtimeState.schema=structuredClone(schema);
    runtimeState.currentSectionIndex=0;
    runtimeState.answers={};
    runtimeState.startedAt=new Date().toISOString();
    runtimeState.completedAt=null;
    runtimeState.submitted=false;
    renderRuntime();
    return true;
}

function renderRuntime(){
    const schema=runtimeState.schema;
    if(!schema){
        return;
    }
    const sections=schema.sections;
    const index=runtimeState.currentSectionIndex;
    const section=sections[index];
    if(!section){
        submitRuntime();
        return;
    }
    const runtimeApp=document.getElementById("runtimeApp");
    const content=document.getElementById("runtimeContent");
    runtimeApp.hidden=false;
    content.innerHTML=renderRuntimeSection(section);
    updateRuntimeProgress();
    attachRuntimeInputs();
    attachRuntimeNavigation();
}

function renderRuntimeSection(section){
    return `<section class="runtime-section">
        <h1 class="runtime-section-title">
            ${escapeHTML(section.title)}</h1>
            ${section.description? `
            <p class="runtime-section-description">
            ${escapeHTML(section.description)}</p>`:""
            }
            <div class="runtime-questions">
            ${section.questions.map( renderRuntimeQuestion).join("")}
            </div>
        </section>`;
}

function renderRuntimeQuestion(question){
    const answer=runtimeState.answers[question.id];
    const required=question.required? 
    `<span class="runtime-required">*</span>`: "";
    let input="";
    switch(question.type){
        case "short-answer":
            input=`<input type="text"
                class="runtime-input"
                data-question-id="${question.id}"
                value="${escapeAttribute(answer || "")}"
                placeholder="${escapeAttribute(question.placeholder || "")}">`;
            break;
        case "paragraph":
            input=`<textarea class="runtime-input"
                    rows="5" data-question-id="${question.id}"
                    placeholder="${escapeAttribute(question.placeholder || "")}"
                >${escapeHTML(answer || "")}</textarea>`;
            break;
        case "multiple-choice":
            input=renderRuntimeOptions(question,answer,"radio");
            break;
        case "checkboxes":
            input=renderRuntimeOptions(question,answer || [],"checkbox");
            break;
        case "dropdown":
            input=renderRuntimeDropdown(question,answer);
            break;
        default:input=`
            <input type="text" class="runtime-input"
                data-question-id="${question.id}">`;
    }
    return `<div class="runtime-question" data-question="${question.id}">
            <label class="runtime-question-label">
            ${escapeHTML(question.title)} ${required}
            </label>
            ${ question.description? `
            <div class="runtime-question-description">
            ${escapeHTML(question.description)} </div>`: ""
            } ${input}
        </div>`;
}

function renderRuntimeOptions(question,answer,type){
    const selected=Array.isArray(answer)?answer:[answer];
    return question.options.map((option,index)=>{
        const checked=selected.includes(option)?"checked":"";
                return `<label class="runtime-option">
                    <input type="${type}"
                        name="question-${question.id}"
                        value="${escapeAttribute(option)}"
                        data-question-id="${question.id}"
                        ${checked}>
                    <span>${escapeHTML(option)}</span>
                    </label>`;
            }).join("");
}

function renderRuntimeDropdown(question,answer){
    return `<select class="runtime-input" data-question-id="${question.id}">
            <option value="">Select an option</option>
            ${question.options.map(option=>`
                <option value="${escapeAttribute(option)}"
            ${answer===option? "selected": ""}>${escapeHTML(option)}
            </option> `).join("")}</select> `;
}

function handleRuntimeInput(event){
    const input=event.currentTarget;
    const questionId=input.dataset.questionId;
    if(input.type==="checkbox"){
        const checked=document.querySelectorAll(
            `input[data-question-id="${questionId}"]:checked`);
        runtimeState.answers[questionId]=[...checked].map(item=>item.value);
        return;
    }
    runtimeState.answers[questionId]=input.value;
}

function attachRuntimeInputs(){
    document.querySelectorAll( "[data-question-id]").forEach(input=>{
        input.addEventListener("input", handleRuntimeInput);
        input.addEventListener("change", handleRuntimeInput);});
}

function validateCurrentSection(){
    const section=runtimeState.schema.sections[runtimeState.currentSectionIndex];
    const missing=[];
    section.questions.forEach(question=>{
        if(!question.required){return;}
        const answer=runtimeState.answers[ question.id];
        const empty=answer===undefined || answer===null ||
            answer==="" || (Array.isArray(answer) && answer.length===0);
            if(empty){missing.push(question.id);
        }});
    return missing;
}

function getNextSectionIndex(){
    const schema=runtimeState.schema;
    const currentSection=schema.sections[runtimeState.currentSectionIndex]
    for (const question of currentSection.questions){
        const answer=runtimeState.answers[question.id];
        for(const rule of question.logic || []){
            if(evaluateRule(rule, answer)){
                const targetIndex=schema.sections.findIndex(section=>sections===rule.target );
                if(targetIndex!==-1){return targetIndex;}}}}
    return (runtimeState.currentSectionIndex+1);
}

function evaluateRule(rule,answer){
    switch (rule.condition){
        case "equals":return answer===rule.value;
        case "not-equals":return answer!==rule.value;
        case "contains":
            if(Array.isArray(answer)){
                return answer.includes(rule.value);
            }
            return String(answer || "").includes(rule.value);
        case "greater-than":
            return Number(answer)>Number(rule.value);
        case "less-than":
            return Number(answer)<Number(rule.value);
        case "is-empty":
            return (answer===undefined || answer===null || answer==="");
        case "is-not-empty":
            return !(answer===undefined || answer===null || answer==="");
        default: return false;
    }
}

function attachRuntimeNavigation(){
    const navigation=document.getElementById("runtimeNavigation");
    const index=runtimeState.currentSectionIndex;
    const total=runtimeState.schema.sections.length;
    const isFirst=index===0;
    const isLast=index===total-1;
    navigation.innerHTML=`${!isFirst?`<button type="button"
        class="runtime-button secondary"
        id="runtimeBack"><i class="fa-solid fa-arrow-left"></i>Back
         </button>`: `<span></span>`}
        <button type="button" class="runtime-button primary"
            id="runtimeNext">
            ${isLast? "Submit": "Continue"}
            ${isLast? `<i class="fa-solid fa-check"></i>`
            : `<i class="fa-solid fa-arrow-right"></i>`}</button>`;
    document.getElementById("runtimeNext").addEventListener("click",runtimeNext);
    const back=document.getElementById("runtimeBack");
    if(back){back.addEventListener("click",runtimeBack); }
}

function runtimeNext() {
    const missing=validateCurrentSection();
    if(missing.length){highlightMissingQuestions(missing);
        return;
    }
    const nextIndex=getNextSectionIndex();
    if(nextIndex>=runtimeState.schema.sections.length){submitRuntime();
        return;
    }
    runtimeState.currentSectionIndex=nextIndex;
    renderRuntime();
}

function runtimeBack() {
    if(runtimeState.currentSectionIndex<=0){return;}
    runtimeState.currentSectionIndex--;
    renderRuntime();
}

function updateRuntimeProgress(){
    const total=runtimeState.schema.sections.length;
    const current=runtimeState.currentSectionIndex+1;
    const percentage=(current/total)*100;
    document.getElementById(
      "runtimeProgressLabel").textContent=`Section ${current} of ${total}`;
    document.getElementById("runtimeProgressBar").style.width=`${percentage}%`;
}

function highlightMissingQuestions(questionIds){
    questionIds.forEach(questionId=>{
        const element=document.querySelector(`[data-question="${questionId}"]`);
        if(!element) {return;}
        element.classList.add( "runtime-question-error");
        element.scrollIntoView({behavior: "smooth",block: "center"});
        setTimeout(()=>{element.classList.remove("runtime-question-error");},1800);
        });
}

function submitRuntime(){
    runtimeState.completedAt=new Date().toISOString();
    runtimeState.submitted=true;
    const submission={id:crypto.randomUUID(),
        formId:runtimeState.schema.id,
        startedAt:runtimeState.startedAt,
        completedAt:runtimeState.completedAt,
        answers:structuredClone(runtimeState.answers)};
    console.log("SUBMISSION", submission);
    renderSubmissionSuccess(submission);
}

function renderSubmissionSuccess(){
    const content=document.getElementById("runtimeContent");
    const navigation=document.getElementById("runtimeNavigation");
    content.innerHTML= `<section class="runtime-section"
        style="text-align:center">
        <div style="font-size:50px; margin-bottom:20px;">
        <i class="fa-solid fa-circle-check"></i></div>
        <h1> Response submitted</h1>
        <p class="runtime-section-description">
            ${escapeHTML(runtimeState.schema.settings.confirmationMessage)}
            </p></section>`;
    navigation.innerHTML="";
}

//Initialize FastForm after the documents are ready

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",{
    once:true
  });
}
  else{initializeApplication();
}