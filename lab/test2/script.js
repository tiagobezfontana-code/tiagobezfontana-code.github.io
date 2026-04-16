
const lot = document.getElementById("lot")

for(let i=1;i<=20;i++){

const space=document.createElement("div")
space.className="space"
space.innerText="P"+i

space.onclick=()=>{
space.classList.toggle("reserved")
}

lot.appendChild(space)

}
