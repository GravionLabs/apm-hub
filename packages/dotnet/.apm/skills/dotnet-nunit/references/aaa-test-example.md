# AAA Test Example

```csharp
[Test]
public async Task GetUser_WithValidId_ReturnsUser()
{
    // Arrange
    var repo = Substitute.For<IUserRepository>();
    repo.GetByIdAsync("123", Arg.Any<CancellationToken>()).Returns(new User { Id = "123" });
    var sut = new UserService(repo);

    // Act
    var result = await sut.GetUserAsync("123");

    // Assert
    result.ShouldNotBeNull();
    result.Id.ShouldBe("123");
}
```
