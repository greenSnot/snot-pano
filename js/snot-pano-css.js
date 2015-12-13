!function(global) {

     var dom_offset_top;
     var dom_offset_left;
     var snot={

         movingRatio:0.3,
         autoRotation:0,
         frames:0,
         imgs_rotation:[0,0,0,0,0,0],

         pauseAnimation: false,

         dom       : $('#snot-pano'),

         cubeSize : 1024,

         ry : 0,       // Rotate * degree around y axis
         rx : 0,       // Rotate * degree around x axis
         maxfov : 120, // Max field of view (degree)
         minfov : 60,  // Min field of view (degree)
         fov : 90,     // Default field of view
     }

     var _rx;
     var _ry;
     var _imageDownloaded=0;

     function _pointStandardlization(x,y,z){
         var ratio=200/distance3D(x,y,z,0,0,0);
         return [x*ratio,y*ratio,z*ratio];
     }

     global.snot= global.snot|| snot;

     var _setFov = function (degree) {

         if(degree<snot.minfov||degree>snot.maxfov){

             return;

         }

         snot.fov=degree;
         snot.container.style['-webkit-transform']='scale('+Math.tan(snot.maxfov/2*Math.PI/180)/Math.tan(snot.fov/2*Math.PI/180)+')';

    }


     var tween = new TWEEN.Tween(snot)
                          //.easing(TWEEN.Easing.Exponential.Out);
                          .easing(TWEEN.Easing.Quartic.Out);
                          //.easing(TWEEN.Easing.Cubic.Out);
                          //.easing(TWEEN.Easing.Linear);


     var _init = function(config,ajax){
         $('.sprite').remove();
         _imageDownloaded=0;

         cancelAnimationFrame(snot._animateId);

         for(var i in config){
             snot[i]=config[i];
         }

         dom_offset_left=leftPos(snot.dom[0]);
         dom_offset_top=topPos(snot.dom[0]);

         _rx=snot.rx;
         _ry=snot.ry;

         //First init
         if(!ajax){

            snot.camera    = snot.dom.find('#camera')[0],
            snot.container = snot.dom.find('#container')[0],
            snot.dom.find('.link').each(function(){
                $(this).remove();
            });

            snot.width=snot.dom.width();
            snot.height=snot.dom.height();

            //compute the max Horizontal Field of view
            //perspective= projectiveScreenWidth/2
            //           = width/2/tan(maxfov/2)
            snot.perspective=snot.width/2/Math.tan(snot.maxfov/2*Math.PI/180);

            snot.container.style['-webkit-perspective']=snot.perspective+'px';

            //camera offset
            // Z is depth(front) Y is height X is right
            //
            // translateZ setFOV
            // rotateX rotate around X axis
            // rotateY rotate around Y axis
            // translateX translate the Camera to center
            // translateY
            snot.camera.style['-webkit-transform']='translateZ('+snot.perspective+'px) rotateX('+snot.rx+'deg) rotateY('+snot.ry+'deg) translateX('+((snot.cubeSize-snot.width)/-2)+'px) translateY('+((snot.cubeSize-snot.height)/-2)+'px)';
            snot.cameraBaseTransform='translateX('+epsilon((snot.cubeSize-snot.width)/-2)+'px) translateY('+epsilon((snot.cubeSize-snot.height)/-2)+'px)';

         }
         _setFov(snot.fov);
         loadImages(config.imgs_compressed,config.imgs_original,config.imgs_rotation);

         if(config){
             _loadSpots(config.spots);
             _loadComments(config.comments);
         }

         if ( checkMobile() ) {

             snot.container.addEventListener('touchstart',mouseDown,false);
             snot.container.addEventListener('touchmove' ,mouseMove,false);
             snot.container.addEventListener('touchend'  ,mouseUp  ,false);

         } else {

             snot.container.addEventListener('mousedown' ,mouseDown ,false);
             snot.container.addEventListener('mousemove' ,mouseMove ,false);
             snot.container.addEventListener('mouseup'   ,mouseUp   ,false);
             snot.container.addEventListener('mousewheel',mouseWheel,false);

         }

         _animate();

     }

     function loadImages(imgs_compressed,imgs_original,imgs_rotation,onCompressedImagesLoad){
         onCompressedImagesLoad=onCompressedImagesLoad?onCompressedImagesLoad:function(){console.log('Compressed images loaded')};

        var _cubeConfig={

                front :"rotateY(90deg)"+"                rotateZ("+imgs_rotation[0]+"deg)  translateZ(-" + (snot.cubeSize/2)+"px)",
                bottom:"rotateY(90deg)"+"rotateX(90deg)  rotateZ("+imgs_rotation[1]+"deg)  translateZ(-" + (snot.cubeSize/2)+"px) rotateZ(90deg)",
                left  :"rotateY(90deg)"+"rotateY(90deg)  rotateZ("+imgs_rotation[2]+"deg)  translateZ(-" + (snot.cubeSize/2)+"px)",
                back  :"rotateY(90deg)"+"rotateY(180deg) rotateZ("+imgs_rotation[3]+"deg)  translateZ(-" + (snot.cubeSize/2)+"px)",
                top   :"rotateY(90deg)"+"rotateX(-90deg) rotateZ("+imgs_rotation[4]+"deg)  translateZ(-" + (snot.cubeSize/2)+"px) rotateZ(-90deg)",
                right :"rotateY(90deg)"+"rotateY(-90deg) rotateZ("+imgs_rotation[5]+"deg)  translateZ(-" + (snot.cubeSize/2)+"px)"

            };

        var counter=0;
        for(var i in _cubeConfig){

            $('.cube.'+i).css('-webkit-transform',_cubeConfig[i]);
            $('.cube.'+i).css('width' ,snot.cubeSize+2+'px');        // 2 more pixels for overlapping gaps ( chrome's bug )
            $('.cube.'+i).css('height',snot.cubeSize+2+'px');        // 2 more pixels for overlapping gaps ( chrome's bug )

            $('.cube.'+i).attr('src',imgs_compressed[counter]);
            $('.cube.'+i).attr('data-index',counter);
            $('.cube.'+i)[0].onload=function(){
                _imageDownloaded=_imageDownloaded>0?_imageDownloaded+1:1;
                if(_imageDownloaded==6){
                    for(var i in _cubeConfig){
                        $('.cube.'+i).attr('src',imgs_original[$('.cube.'+i).attr('data-index')]);
                    }

                }
            }

            counter++;

        }

     }

     var touches = {

         fx:0,   // First  finger x
         fy:0,   // First  finger y
         sx:0,   // Second finger x
         sy:0    // Second finger y

     };

     var genElement=function(type,id,extra){

         var element= document.createElement('div');
         element.className=type;
         element.id=type.split('_')[0]+'_'+id;
         element.setAttribute('data-id',id);

         element.style.width="1px";
         element.style.height="1px";
         element.style.marginLeft='-50%';
         element.style.zIndex="20";

         if(type.indexOf('spot')==0){
             element.setAttribute('data-scene',extra.scene);
             element.setAttribute('data-type',extra.type);
             element.setAttribute('data-text',extra.text);
             var spot=document.createElement('div');
             var image=document.createElement('div');
             image.className='spot_image';
             spot.className='spot_icon';
             var description=document.createElement('div');
             description.className='spot_description';
             description.innerHTML=extra.text;
             element.appendChild(description);
             spot.appendChild(image);
             element.appendChild(spot);
         }else if(type.indexOf('comment')==0){
             element.style.width="auto";
             element.style.height="auto";
             element.style.marginLeft='auto';
             var comment=document.createElement('div');
             comment.className="comment-content";
             comment.innerHTML=extra.text;
             element.appendChild(comment);
         }

         return element;

     }

     var _loadComments=function(comments){
            // Loading Comments
            for(var i in comments){
                var t=comments[i];
                var element=genElement('comment',t.id,{text:t.text,x:t.position_x,y:t.position_y,z:t.position_z,avatar_url:t.avatar_url,type:t.type,is_description:t.is_description,is_mosaic:t.is_mosaic});
                addSpriteByPosition(element,t.position_x*1.4,t.position_y*1.4,t.position_z*1.4);
            }
     }

     var _loadSpots=function(spots){
         for(var i in spots){
             var t=spots[i];
             var standard=_pointStandardlization(t.position_x,t.position_y,t.position_z);
             t.position_x=standard[0];
             t.position_y=standard[1];
             t.position_z=standard[2];
             var element=genElement('spot_'+t.type,t.id,{text:t.text,scene:t.sceneKey,type:t.type,x:t.position_x,y:t.position_y,z:t.position_z});
             var d=distance3D(t.position_x,t.position_y,t.position_z,0,0,0);
             d=d>0?d:1;
             var ratio=d/400;
             addSpriteByPosition(element,t.position_x/ratio,t.position_y/ratio,t.position_z/ratio);
         }

     }

     var rotate=function(x,y,z,rx,ry){
         var t=text2Matrix('rotateY('+epsilon(-ry)+'deg) rotateX('+epsilon(-rx)+'deg) translate3d('+epsilon(x)+'px,'+epsilon(y)+'px,'+epsilon(z)+'px)');
         return([-parseFloat(t[12]),
                 -parseFloat(t[13]),
                 -parseFloat(t[14])]);
     }

     var addSpriteByPosition=function(element,x,y,z,rx,ry){

         z=-z;
         x=-x;
         y=-y;

         if(rx!=undefined&&ry!=undefined){
             var rotation=rotate(x,y,z,rx,ry);
             addSpriteByPosition(element,rotation[0],rotation[1],rotation[2]);
             return;
         }

         var wrap= document.createElement('div');
         wrap.style.display='inline-block';
         wrap.style.position='absolute';
         wrap.className="sprite";

         wrap.style['-webkit-transform-origin-x']='0';
         wrap.style['-webkit-transform-origin-y']='0';

         var arc=x==0&&z==0?0:Math.acos(z/Math.pow(x*x+z*z,0.5));

         arc=x<0?2*Math.PI-arc:arc;
         arc=arc*180/Math.PI;

         var r=distance3D(x,y,z,0,0,0);
         x+=snot.cubeSize/2;
         y+=snot.cubeSize/2;


         var transform=text2Matrix('translate3d('+epsilon(x)+'px,'+epsilon(y)+'px,'+epsilon(z)+'px) rotateY('+epsilon(arc)+'deg) rotateX('+epsilon((y-snot.cubeSize/2)/r*-90)+'deg) rotateY(180deg)');

         wrap.style['-webkit-transform']=matrix2Text(transform);

         wrap.appendChild( element );
         snot.camera.appendChild( wrap );
     }

     var rotation2Position=function(z,rx,ry){

         z=-z;
         rx=-rx;

         var x=snot.cubeSize/2;
         var y=snot.cubeSize/2;

         var transform = text2Matrix( 'translate3d('+x+'px,'+y+'px,0) rotateY('+(0)+'deg) rotateX('+(0)+'deg) rotateY('+(ry?-ry:0)+'deg) rotateX('+(rx?-rx:0)+'deg) translateZ('+z+'px)' );
         return [-transform[12]+snot.cubeSize/2,transform[13]-snot.cubeSize/2,-transform[14]];

     }

     var mouseMove = function (event) {

         event.preventDefault();
         event.stopPropagation();

         var x=parseInt(event.clientX>=0?event.clientX:event.touches[0].pageX);
         var y=parseInt(event.clientY>=0?event.clientY:event.touches[0].pageY);
         x-=dom_offset_left;
         y-=dom_offset_top;

         touches.click=false;

         if(!touches.onTouching){

             return false;

         }

         if(event.touches&&event.touches.length>1){

                 var cfx=x;                          // Current frist  finger x
                 var cfy=y;                          // Current first  finger y
                 var csx=event.touches[1].pageX;     // Current second finger x
                 var csy=event.touches[1].pageY;     // Current second finger y

                 var dis= distance2D(touches.fx,touches.fy,touches.sx,touches.sy)-distance2D(cfx,cfy,csx,csy);

                 var ratio=0.12;
                 snot.setFov(snot.fov+dis*ratio);

                 touches.fx=cfx;
                 touches.fy=cfy;
                 touches.sx=csx;
                 touches.sy=csy;

                 return false;

         }

         var ratio=snot.movingRatio;

         _ry=_ry+(touches.fx-x)*ratio;
         _rx=_rx-(touches.fy-y)*ratio;

         touches.fx=x;
         touches.fy=y;

         _rx=_rx>90?90  :_rx;
         _rx=_rx<-90?-90:_rx;

         if(isIphone()||isAndroid()||!isIpad()){
            tween
                .to({ry:_ry,rx:_rx},300)
                .start();
         }else{
             snot.camera.style['-webkit-transition']='all 0.3s ease-out';
             snot.rx=_rx;
             snot.ry=_ry;
         }


     };

     var mouseDownX;
     var mouseDownY;
     var mouseDown = function (event) {

         event.preventDefault();
         event.stopPropagation();

         var x=parseInt(event.clientX>=0?event.clientX:event.touches[0].clientX);
         var y=parseInt(event.clientY>=0?event.clientY:event.touches[0].clientY);
         x-=dom_offset_left;
         y-=dom_offset_top;

         mouseDownX=x;
         mouseDownY=y;

         touches.fx=x;
         touches.fy=y;
         touches.click=true;

         if (event.touches&&event.touches.length>1) {

             touches.sx = event.touches[1].pageX;
             touches.sy = event.touches[1].pageY;

         }

         touches.onTouching = true;

     }

     var mouseWheel = function (event) {

         event.preventDefault();
         event.stopPropagation();

         var offset=event.deltaY;
         snot.setFov(snot.fov+offset*0.06);

     }

     var mouseUp = function (event) {

         event.preventDefault();
         event.stopPropagation();

         var x=parseInt(event.clientX>=0?event.clientX:event.changedTouches[0].pageX);
         var y=parseInt(event.clientY>=0?event.clientY:event.changedTouches[0].pageY);
         x-=dom_offset_left;
         y-=dom_offset_top;

         //Screen coordinate to Sphere 3d coordinate
         if (distance2D(mouseDownX,mouseDownY,x,y)<5) {     // Single click

             var R=100;

             var ry=(x/snot.width-0.5)*snot.fov;
             var rx=(y/snot.height-0.5)*snot.fov*snot.height/snot.width;
             var r=Math.cos(snot.fov/2*Math.PI/180)*snot.cubeSize;
             var ratiox=(x-snot.width/2)/snot.width*2;
             var ratioy=(y-snot.height/2)/snot.width*2;
             var P=Math.sin(snot.fov/2*Math.PI/180)*snot.cubeSize;

             ry=Math.atan(ratiox*P/r);
             rx=Math.atan(ratioy*P/r);

             ry*=180/Math.PI;
             rx*=180/Math.PI;

             var xyz2=rotation2Position(R,rx,0);

             //拍扁
             var rr=distance3D(-Math.tan(ry*Math.PI/180)*xyz2[2],-xyz2[1],xyz2[2],0,0,0);
             var ratio=R/rr;

             //重组 归一化
             var rotation=rotate(-Math.tan(ry*Math.PI/180)*xyz2[2]*ratio,-xyz2[1]*ratio,xyz2[2]*ratio,snot.rx,snot.ry);
             var ax=-rotation[0];
             var ay=-rotation[1];
             var az=-rotation[2];

             var minOffset=0.4;
             var minDistance=snot.minDetectDistance;
             var nearest;
             $('.sprite').each(function(){
                 var matrix=text2Matrix($(this)[0].style.webkitTransform);
                 var rate_=100/distance3D(0,0,0,snot.cubeSize/2-matrix[12],matrix[13]-snot.cubeSize/2,-matrix[14]);

                 var distance=distance3D(ax,-ay,az,(snot.cubeSize/2-matrix[12])*rate_,rate_*(matrix[13]-snot.cubeSize/2),rate_*(-matrix[14]));
                 if(distance<minDistance){
                     minDistance=distance;
                     nearest=$(this).children().eq(0);
                 }
             });

             var rotation=position2rotation(ax,az,ay);
             if(nearest){
                 snot.onSpriteClickCallback(nearest,ax,ay,az,rotation[0],rotation[1]);
             }else{
                 snot.onClickCallback(ax,ay,az,rotation[0],rotation[1]);
             }

         }

         touches.onTouching=false;

     }


     function _animate() {
         snot._animateId=requestAnimationFrame( _animate );
         if(!snot.pauseAnimation){
             _update();
             TWEEN.update();
         }
     }

     function _update() {
         snot.frames++;

         snot.ry+=snot.autoRotation;
         _ry+=snot.autoRotation;

         snot.camera.style.webkitTransform = 'translateZ('+epsilon(snot.perspective)+'px)'+' rotateX('+epsilon(snot.rx)+'deg) rotateY('+epsilon(snot.ry)+'deg)'+ snot.cameraBaseTransform;

     }

     var _setRx=function(rx,smooth){
         if(!smooth){
             snot.rx=rx;
         }else{
             snot.camera.style['-webkit-transition']='none';
             snot.rx=rx;
             _update();
             snot.camera.style['-webkit-transition']='all 0.3s ease-out';
         }
     }

     var _setRy=function(ry,smooth){
         if(!smooth){
             snot.ry=ry;
         }else{
             snot.camera.style['-webkit-transition']='none';
             snot.ry=ry;
             _update();
             snot.camera.style['-webkit-transition']='all 0.3s ease-out';
         }
     }

     $.extend(global.snot,{
        setFov: _setFov,
        setRx: _setRx,
        setRy: _setRy,
        init: _init,
        loadSpots: _loadSpots,
        loadComments: _loadComments
     });
}(window);
