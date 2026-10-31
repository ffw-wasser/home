package de.feuerwehrwasser.h2o
import org.junit.Assert.*
import org.junit.Test
class PortalLinksTest {
    @Test fun linksAcceptOnlyTheExactMemberEndpoints() {
        assertTrue(PortalLinks.trusted(PortalLinks.HOME))
        assertTrue(PortalLinks.trusted("https://ffw-wasser.github.io/home/termin.html?event=test"))
        for (url in listOf("http://ffw-wasser.github.io/home/deckel.html", "https://ffw-wasser.github.io.evil.test/home/deckel.html", "https://user@ffw-wasser.github.io/home/deckel.html", "https://ffw-wasser.github.io:443/home/deckel.html", "https://ffw-wasser.github.io/home/index.html", "javascript:alert(1)", "https://ffw-wasser.github.io/home/%64eckel.html")) assertFalse(url, PortalLinks.trusted(url))
    }
    @Test fun invitationsRequireOneSetupCode() {
        val url = PortalLinks.HOME + "#setup=" + "a".repeat(43)
        assertTrue(PortalLinks.setupLink(url))
        for (value in listOf(PortalLinks.HOME, url + "&k=secret", PortalLinks.HOME + "?next=evil#setup=" + "a".repeat(43), PortalLinks.HOME + "#setup=short")) assertFalse(PortalLinks.setupLink(value))
    }
}

