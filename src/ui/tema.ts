/** Roda no <head>, antes da pintura. Padrão escuro; a escolha salva vence. Impressão sempre clara. */
export const SCRIPT_TEMA = `(function(){
  var chave="cs-tema";
  var salvo=null;
  try{salvo=localStorage.getItem(chave);}catch(e){}
  var tema=salvo==="light"||salvo==="dark"?salvo:"dark";
  document.documentElement.setAttribute("data-theme",tema);
  var abertos=[];
  window.addEventListener("beforeprint",function(){
    document.documentElement.setAttribute("data-print-theme",document.documentElement.getAttribute("data-theme")||"dark");
    document.documentElement.setAttribute("data-theme","light");
    abertos=[];
    document.querySelectorAll("details.cs-disclosure").forEach(function(d){
      if(!d.open){d.setAttribute("data-print-open","");d.open=true;abertos.push(d);}
    });
  });
  window.addEventListener("afterprint",function(){
    var antes=document.documentElement.getAttribute("data-print-theme");
    if(antes)document.documentElement.setAttribute("data-theme",antes);
    abertos.forEach(function(d){d.open=false;d.removeAttribute("data-print-open");});
  });
})();`;
