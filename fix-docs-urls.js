javascript:(function(){
  /* Bookmarklet: Resolve externalDocsUrl links
   *
   * On GitHub code view pages, replaces occurrences of
   * ${externalDocsUrl}/[path] with clickable links pointing to
   * https://docs.github.com/en/enterprise-cloud@latest/[path]
   *
   * Links open in a new tab and do not trigger GitHub's
   * underlying code view click handlers.
   */
  var base='https://docs.github.com/en/enterprise-cloud@latest/';
  var re=/^\$\{externalDocsUrl\}\/(.+)$/;
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);
  var nodes=[];
  while(walker.nextNode()){
    var t=walker.currentNode.nodeValue;
    if(t&&re.test(t)){
      nodes.push(walker.currentNode);
    }
  }
  nodes.forEach(function(node){
    var m=node.nodeValue.match(re);
    if(!m)return;
    var path=m[1];
    var url=base+path;
    var a=document.createElement('a');
    a.href=url;
    a.target='_blank';
    a.rel='noopener';
    a.textContent=url;
    a.style.cssText='color:#1f6feb;text-decoration:underline;cursor:pointer;';
    a.addEventListener('click',function(e){
      e.stopPropagation();
      e.preventDefault();
      window.open(url,'_blank','noopener');
    },true);
    node.parentNode.replaceChild(a,node);
  });
})();
