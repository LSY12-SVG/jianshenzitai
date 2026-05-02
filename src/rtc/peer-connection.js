const ICE_SERVERS = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

export function createRtcPeer({
  localStream = null,
  onIceCandidate,
  onRemoteStream,
  onConnectionStateChange,
} = {}) {
  const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const remoteStream = new MediaStream();
  let recvVideoTransceiver = null;

  if (localStream) {
    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }
  } else {
    // Explicitly request a remote video m-line; relying only on offerToReceiveVideo
    // is not stable across browser combinations.
    recvVideoTransceiver = peerConnection.addTransceiver("video", {
      direction: "recvonly",
    });
  }

  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      const c = event.candidate;
      const candidateObj = {
        candidate: c.candidate ?? "",
        sdpMid: c.sdpMid ?? null,
        sdpMLineIndex: c.sdpMLineIndex ?? null,
        usernameFragment: c.usernameFragment ?? null,
      };
      onIceCandidate?.(candidateObj);
    }
  });

  peerConnection.addEventListener("track", (event) => {
    for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
      const hasTrack = remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id);

      if (!hasTrack) {
        remoteStream.addTrack(track);
      }
    }

    onRemoteStream?.(remoteStream);
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    onConnectionStateChange?.(peerConnection.connectionState);
  });

  async function createOffer() {
    if (recvVideoTransceiver) {
      recvVideoTransceiver.direction = "recvonly";
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const localDesc = peerConnection.localDescription;
    return { type: localDesc.type, sdp: localDesc.sdp };
  }

  async function acceptOffer(description) {
    if (!description || typeof description !== "object") {
      return;
    }

    try {
      await peerConnection.setRemoteDescription(description);
    } catch (e) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    }
  }

  async function createAnswer() {
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    const localDesc = peerConnection.localDescription;
    return { type: localDesc.type, sdp: localDesc.sdp };
  }

  async function applyAnswer(description) {
    if (!description || typeof description !== "object") {
      return;
    }

    try {
      await peerConnection.setRemoteDescription(description);
    } catch (e) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    }
  }

  async function addIceCandidate(candidate) {
    if (!candidate) {
      return;
    }
    try {
      const c = typeof candidate === "string" ? JSON.parse(candidate) : candidate;
      if (c && typeof c === "object" && typeof c.candidate === "string") {
        await peerConnection.addIceCandidate(new RTCIceCandidate(c));
      }
    } catch {
      // candidate format error, skip
    }
  }

  async function replaceVideoTrack(nextTrack) {
    const sender = peerConnection.getSenders().find((item) => item.track?.kind === "video");

    if (!sender) {
      return;
    }

    await sender.replaceTrack(nextTrack);
  }

  function close() {
    remoteStream.getTracks().forEach((track) => track.stop());
    peerConnection.close();
  }

  return {
    createOffer,
    acceptOffer,
    createAnswer,
    applyAnswer,
    addIceCandidate,
    replaceVideoTrack,
    close,
  };
}
