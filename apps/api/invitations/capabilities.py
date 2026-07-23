from invitations.models import Invitation


RSVP_PACKAGE_CODES = frozenset({"signature", "couture"})
GUEST_WISHES_PACKAGE_CODES = RSVP_PACKAGE_CODES


def invitation_package_code(invitation: Invitation) -> str:
    if not invitation.package_id:
        return "essential"
    return str(invitation.package.code).strip().lower()


def invitation_supports_rsvp(invitation: Invitation) -> bool:
    return invitation_package_code(invitation) in RSVP_PACKAGE_CODES


def invitation_supports_guest_wishes(invitation: Invitation) -> bool:
    return invitation_package_code(invitation) in GUEST_WISHES_PACKAGE_CODES
