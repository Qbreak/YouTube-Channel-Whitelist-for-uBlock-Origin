/*
	This script is injected into the YT page so that we
	can access local JS variables rather than just the dom.
	This is important because the new Polymer design puts
	a lot of important information out of reach and in
	Polymer.

*/
'use strict';

(function(window, document, undefined){
	function Agent(){
		let internalFunctions = {};

		this.registerListener = function(name, func){
			internalFunctions[name] = func;
			return this;
		};

		window.addEventListener("message", function(event){
			if(!event.data || !event.data.internalFunction) return;

			if(event.data.internalFunction in internalFunctions){
				let ret = internalFunctions[event.data.internalFunction](event.data.message);

				if(event.data.callbackId)
					window.postMessage({callbackId: event.data.callbackId, callbackMessage: ret}, event.origin);
				
			}
		})
	}
	
	new Agent().registerListener("updateChannel", function(){
		//make UCID available in the DOM
		let container = document.querySelector("ytd-browse");
		if(!container) return;

		let channelURL = objGet(container, "data.metadata.channelMetadataRenderer.channelUrl");
		let username = objGet(container, "data.metadata.channelMetadataRenderer.doubleclickTrackingUsername");

		if(channelURL){
			let link = document.querySelector("link[rel='canonical']");
			
			if(!link){
				link = document.createElement("link");
				link.rel = "canonical";
				document.head.appendChild(link);
			}

			link.href = container.data.metadata.channelMetadataRenderer.channelUrl;
			
			if(username)
				link.setAttribute("username", username)
			else
				link.removeAttribute("username");

			return link.href;
		}
	}).registerListener("updateVideoLists", function(args){
		//channel = are we on a whitelisted channel page?
		let channelPage = !!args.channelId;
		let forceUpdate = !!args.forceUpdate;
		let whitelisted = args.settings.whitelisted.map(item => item.id);
		let videos;

		if(args.type === "related"){
			videos = document.querySelectorAll("ytd-compact-video-renderer,ytd-playlist-panel-video-renderer");
		}else if(args.type === "general"){
			videos = document.querySelectorAll("ytd-grid-video-renderer,ytd-video-renderer");
		}

		for(let video of videos){
			if(!forceUpdate && video.data.processed) continue;

			let id;

			if(id = objGet(video, "data.shortBylineText.runs[0].navigationEndpoint.browseEndpoint.browseId") || (channelPage && args.channelId.id)){

				let desturl, links = video.querySelectorAll("a[href^='/watch?']");

				if(!links.length) continue;

				if(whitelisted.indexOf(id) !== -1){
					if(video.data.originalhref)
						desturl = video.data.originalhref;
					else{
						desturl = links[0].getAttribute("href");
						video.data.originalhref = desturl;
					}
					desturl += "&disableadblock=1";
				}else if(video.data.originalhref){
					desturl = video.data.originalhref;
				}else{
					video.data.processed = true;
					continue;
				}

				for(let link of links)
					link.href = desturl;

				if(objGet(video, "data.navigationEndpoint.webNavigationEndpointData.url"))
					video.data.navigationEndpoint.webNavigationEndpointData.url = desturl;
				if(objGet(video, "data.navigationEndpoint.commandMetadata.webCommandMetadata.url"))
					video.data.navigationEndpoint.commandMetadata.webCommandMetadata.url = desturl;
				
				video.data.processed = true;
			}
		}
	}).registerListener("updateSearch", function(args){
		let channels = document.querySelectorAll("ytd-channel-renderer");

		for(let channel of channels){
			let id = objGet(channel, "data.channelId");
			let channelURL = channel.querySelector(".UBO-hide");

			if(id){
				if(channelURL){
					channelURL.setAttribute("href", "/channel/" + id);
				}else{
					channel.querySelector("#metadata").appendChild((() => {
						let el = document.createElement("a");
						el.setAttribute("class", "UBO-hide");
						el.setAttribute("href", "/channel/" + id);
						return el;
					})())
				}
			}
		}
	}).registerListener("verifyDisabled", function(args){
		setTimeout(() =>
			fetch("https://www.youtube.com/favicon.ico?ads=true")
			.catch(() =>
				prompt("Ads may still be blocked, make sure you've added the following rule to your uBlock Origin whitelist", "*youtube.com/*&disableadblock=1")
			)
		, 300);
	});

	function objGet(object, key){
		let levels = key.split(/[\[\]\.]+/);
		let current = object;

		for(let level of levels){
			if(level.length === 0) continue;
			if(current[level] !== undefined){
				current = current[level];
			}else{
				//console.log("Failed at", level);
				return;
			}
		}

		return current;
	}
})(window, document);