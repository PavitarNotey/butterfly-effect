"""Reviewed demo/fallback readings of the three synthetic passages, never AI output."""

from .models import EvidencePacket, Mode

# These readings describe the current recorded passages. They do not assert
# attention, invented alternatives, or that the run/dummy caused the outcome.
READINGS = {
    "the-untouched-pass": {
        "run": (
            "An arrival beyond the ball",
            "Watch Kian Merrick rather than only the ball. His recorded approach continues toward the receiving point while Felix Arden stays close to his route. Asa Bellamy's later diagonal travels beyond Soren Ellery to meet that arrival. The interesting detail is the relationship between a moving receiver and a pass that keeps travelling, rather than an attacker waiting for the ball.",
            "The receiving run is the thread connecting this move. Kian Merrick advances toward the eventual receiving point while Felix Arden's separation narrows during the approach. That is nearby cover, rather than an unopposed arrival. In the continuation, Asa Bellamy releases the diagonal through Soren Ellery's position and Merrick meets it beyond him. The tactical reading is about coordinating movement with a travelling pass: keep Merrick in view alongside the ball and compare his route with Arden's recovery. Compare his starting position with the arrival to see the complete approach available in this replay.",
            "Follow Merrick's route alongside Arden before watching the pass.",
        ),
        "dummy": (
            "The ball continues untouched",
            "The pass continues to Kian Merrick because Soren Ellery leaves it untouched. That is the key detail: follow the ball beyond Ellery and pick up Merrick's arrival, rather than treating Ellery as the receiver. Asa Bellamy's diagonal and Merrick's run belong to the same passage. With Felix Arden closing nearby, watch the reception and the quick shot in the continuation.",
            "The pass continues to Kian Merrick because Soren Ellery leaves it untouched. Asa Bellamy's diagonal travels through Ellery's position toward the receiving run, with no possession transfer at the dummy. The receiving run carries the tactical story beyond the attacker nearest the ball. The ball has a route through the nearby defenders, while Felix Arden narrows the gap to Merrick around the arrival. That contrast matters: an available ball route does not mean the receiver is free of nearby cover. Watch the uninterrupted pass first, then Merrick's reception and the shot in the continuation.",
            "Watch the same pass travel beyond Ellery to the moving receiver.",
        ),
        "receive": (
            "An arrival with cover closing",
            "Kian Merrick meets the pass beyond Soren Ellery, with Felix Arden and Cassian Reid nearby. This is a receiving position under closing cover, rather than empty space around a stationary attacker. The tactical detail is the timing of the arrival against that narrowing gap. Follow Merrick's control into the shot, and compare the ball's position with the defenders around him.",
            "Kian Merrick's arrival brings the earlier run and the untouched pass together. Asa Bellamy's diagonal has continued beyond Soren Ellery, and Merrick receives with Felix Arden and Cassian Reid nearby. The receiving-space observation and the narrowing separation to Arden describe different parts of that picture: room around the receiving point and closing cover around the player. Read this as a reception under nearby pressure, rather than a completely free shooting position. Watch the control and the subsequent release together, keeping the nearest-cover line in view. The relevant contrast is the travelling ball meeting the run as the defensive gap narrows.",
            "Compare Merrick's first control with the cover closing beside him.",
        ),
        "shot": (
            "The arrival becomes a finish",
            "Kian Merrick's shot is the end of a connected move, rather than an isolated strike. The pass has travelled beyond Soren Ellery untouched, and Merrick controls before releasing the ball with defenders nearby. Watch reception and shot together to see the brief transition from arriving runner to finisher. The recorded goal completes the passage; the earlier movement remains the context for understanding the opportunity.",
            "Start with Kian Merrick's reception when watching this finish. The same diagonal has travelled beyond Soren Ellery without a touch, then Merrick controls and shoots as Felix Arden and Cassian Reid close. The tactical significance lies in that compact sequence of arrival, control and release, rather than in the goal alone. Compare the receiving-space observation with the recovering players around the shot path. The goal is recorded, but those measurements describe the conditions around the finish rather than proving the earlier dummy was necessary. Keep the ball and the nearest defenders in view through the release.",
            "Watch reception through release, with the recovering defenders in view.",
        ),
    },
    "the-invisible-run": {
        "run": (
            "The runner and the passing route",
            "Follow Rowan's diagonal alongside the defensive shift, then look inside for Voss. Rowan's movement and Voss's receiving position are different parts of the attack. Linden's later pass uses the inside-right channel after the reshaping. The tactical interest is the relationship between that outside movement and the inside ball route. Compare both before following the reception into the finish.",
            "Rowan's diagonal is worth watching away from the ball. Mercer and North move within the defensive reshaping while Voss is the eventual receiver of Linden's inside-right pass. The useful tactical comparison is between the runner's route, the adjusted defensive positions and the channel used by the ball. These are connected recorded movements, rather than proof of the defenders' motivation. In the continuation, Voss receives on the move before settling and shooting. Track the diagonal first, then compare the passing corridor with the cover around Voss at reception.",
            "Watch Rowan first, then switch attention to Voss inside.",
        ),
        "pass": (
            "The inside-right route",
            "Linden's pass uses the inside-right channel after the defensive shift. Voss is moving to receive, so the important comparison is the ball route against the cover around that arrival. Rowan's earlier diagonal gives the passage its wider context. Watch the release through reception, then keep the nearest defenders in view as Voss settles for the shot.",
            "Linden releases through the inside-right channel after the recorded reshaping. The passing corridor and Voss's arrival are complementary parts of the opportunity: the ball has a route through the shape, while nearby cover still matters at reception. Rowan's earlier diagonal supplies context for that shape without establishing why a defender moved. Compare the moving-ball corridor with the receiving-space observation rather than treating clearance as a prediction of success. Follow Voss's control into the settling action and shot, keeping Pike and Mercer in view around the receiver.",
            "Follow the passing route into Voss's receiving position.",
        ),
        "receive": (
            "Voss meets the moving pass",
            "Voss receives on the move as Pike and Mercer close. The key is to watch the reception and settling action together, rather than jumping straight to the shot. The earlier inside-right pass meets the attacker in this receiving position. Compare Voss with the nearest cover to understand the space around the control before the finish develops.",
            "Voss's reception connects Linden's inside-right pass with the finish. The receiving-space observation describes the area around the arrival, while nearby Pike and Mercer provide the defensive context. Voss controls on the move and settles before shooting; this is the part of the sequence to watch rather than treating the strike as detached from the buildup. Compare the ball at control with the nearest-cover line, then follow the settling action through release. Rowan's earlier diagonal remains context for the changed shape, without establishing defender attention or an alternative outcome.",
            "Compare the control and settling action with the nearest cover.",
        ),
        "shot": (
            "From control to release",
            "Voss turns a moving reception into a settled shot while Pike and Mercer close. Watch the ball from control through release to see how the finish fits the earlier passing move. The recorded goal completes that passage. The nearby cover and the shot path are the useful context around that recorded outcome, alongside the earlier run and inside-right pass.",
            "The finish follows Voss's moving reception and settling action, with Pike and Mercer closing around the play. Watch those actions as a continuous passage: Linden's inside-right pass reaches the receiver, control prepares the ball, and the shot follows. The recovering-player observation describes proximity to the ball path during the shot, alongside the recorded release. Keep the nearest cover in view alongside the release. The recorded goal is the outcome, while the earlier diagonal and defensive reshaping remain the supported context for how the opportunity developed.",
            "Watch the settling action and release with Pike and Mercer nearby.",
        ),
    },
    "the-missed-chance": {
        "run": (
            "Width with central cover intact",
            "Quinn's outside run sits alongside Rook's drop, while Ward remains near the central channel. That balance is the useful detail away from the ball. The continuation reaches Finch through Marr's forward pass, with central cover still part of the picture. Watch the wide movement and the inside defenders together before following the ball into the receiving position.",
            "Quinn's outside run gives this passage its away-from-ball context. Rook drops with the wide route while Ward remains near the central channel and Stone covers centrally. The tactical reading is a balance between width and central protection, supported by the recorded positions rather than an invented decision. In the continuation, Marr's forward pass reaches Finch and the central cover remains relevant around reception. Compare the outside route with the inside defenders, then watch Stone's separation to Finch narrow before the shot. The eventual miss is a recorded outcome, not proof of the defensive movement's necessity.",
            "Compare the wide run with the cover remaining inside.",
        ),
        "pass": (
            "A forward route with cover nearby",
            "Marr's forward pass reaches Finch ahead of the back line, but Stone is goal-side of the receiver and Hart is recovering. The useful detail is that a completed forward pass and an unopposed chance are different things. Watch the reception through the closing gap, then follow Finch's preparation for the shot rather than stopping at the pass.",
            "Marr's forward pass reaches Finch ahead of the back line, with Stone goal-side and Hart recovering. The passing corridor describes the route used by the ball; the defensive relationship describes the situation Finch meets on arrival. Keep those observations together rather than treating a completed pass as an assessment of chance quality. Quinn's earlier outside run supplies the wider context while central cover remains relevant. Follow the ball into reception, compare Stone's position with Finch, and then watch the measured separation narrow before the shot. The miss in the continuation does not establish why the attempt failed.",
            "Watch the pass arrive, then compare Finch with Stone.",
        ),
        "recovery": (
            "The gap narrows before the shot",
            "Finch receives with Stone goal-side and Hart recovering. Stone's separation to Finch then narrows before the shot, while Ward balances nearby. That is the tactical detail worth watching: the receiving situation changes during the preparation for the attempt. Keep the nearest-cover line in view as Finch sets the ball. The later miss is recorded without proving that the pressure explains it.",
            "Finch's reception begins a changing defensive relationship rather than a static shooting picture. Stone is goal-side, Hart recovers from behind and the measured separation to Stone narrows before release. Ward provides the nearby balancing context. The tactical significance is the closing cover during the preparation for the shot, supported by the distance change rather than a claim about Finch's thinking. Compare reception with the later recovery frame, then follow the ball through the attempt. The shot misses outside the post in the continuation; that outcome does not establish that the closing defender made it happen.",
            "Compare the cover at reception with the gap before release.",
        ),
        "shot": (
            "Pressure around an attempt that misses",
            "Finch shoots after receiving with Stone nearby and the gap closing during the preparation. Watch the release against that recovering cover, then follow the ball outside the post. This connects the miss to the actual conditions around the attempt without inventing a block or save. The useful replay detail is the relationship between the shooter, the nearest defender and the ball path.",
            "The shot follows Finch's reception and preparation under nearby cover. Stone's separation narrows before release while Ward balances around the play. Compare that defensive relationship with the ball at the shot, then follow its recorded crossing outside the post. The recovering-player measurement describes proximity to the shot path, rather than proving a block, save or reason for the miss. This is a passage with a forward opportunity and closing cover in the same picture. Keep both in view rather than reading the result alone as a verdict on the earlier pass or the shooter's decision.",
            "Watch the nearest defender at release, then the ball outside the post.",
        ),
    },
}


def authored_moment(packet: EvidencePacket, target: str, mode: Mode):
    """Return reviewed headline, explanation and replay takeaway for target/mode.

    Multi-target packets use a brief current-cue excerpt. None leaves the
    provider's generic/non-moment fixture path in control; no model is called.
    """
    readings = READINGS[packet.scenario_id]
    if target not in readings:
        return None
    headline, casual, analyst, takeaway = readings[target]
    explanation = casual if mode == "casual" else analyst
    if len(packet.target_ids) > 1:
        # Commentary must fit a full cue set and remain about the current cue.
        explanation = explanation.split(". ", 1)[0].rstrip(".") + "."
    return headline, explanation, takeaway
