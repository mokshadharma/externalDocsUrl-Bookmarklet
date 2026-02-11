javascript:(function(){
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
  var count=0;
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
    node.parentNode.replaceChild(a,node);
    count++;
  });
  alert('Bookmarklet done: '+count+' link(s) replaced.');
})();
